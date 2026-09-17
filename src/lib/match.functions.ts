import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const CandidateSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const LineSchema = z.object({
  line: z.string(),
  size: z.string(),
  category: z.string().default(""),
  candidates: z.array(CandidateSchema).max(16),
});

const MatchInput = z.object({
  lines: z.array(LineSchema).max(40),
});

export type MatchVerdict = { productId: string | null; confidence: number; reason: string };

const SYSTEM_PROMPT = `You match a line from an Indian hypermarket bill to the single best like-for-like product from Swiggy Instamart's private label "Just" catalog.

For every bill line you get a shortlist of candidate Just products. Pick the ONE candidate a shopper would accept as the same thing, or return null when none of them is a fair swap.

Rules:
- Same product type and same pack form. A detergent BAR is not a detergent POWDER. An air-freshener BLOCK is not a SPRAY. A storage container is not aluminium foil.
- Understand Indian brand and Hindi shorthand: GODREJ N1 LEM = lemon bathing soap, HIN/HINGRAJ = hing (asafoetida), JEERA = cumin, DHANIA = coriander, AATA/GEHU = wheat atta, TEL = oil, BADAM = almond, SAFFOLA/FORTUNE = edible oil, LIJJAT = papad, WADAKOLAM = Wada Kolam rice.
- Plain "atta" means chakki atta, not multigrain/nachni/loose variants. Plain oil means the blended/refined cooking oil, not a named speciality variety, unless the bill names that variety.
- Never pair personal care or home care with food, and never match on brand name alone.
- Prefer the candidate whose pack size is closest to the bill's pack size, but only after type and form are right.
- confidence: 0 to 1. Use below 0.5 when unsure; the app treats low confidence as no match.
Return one verdict per bill line, in the same order, using the candidate's exact id.`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["line_index", "product_id", "confidence", "reason"],
        properties: {
          line_index: { type: "number" },
          product_id: { type: ["string", "null"] },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

async function hashKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cacheClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const resolveMatches = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MatchInput.parse(input))
  .handler(async ({ data }): Promise<Array<MatchVerdict | null>> => {
    const lines = data.lines;
    const verdicts: MatchVerdict[] = lines.map(() => ({
      productId: null,
      confidence: 0,
      reason: "",
    }));
    // `undefined` marks "no verdict, keep the deterministic pick".
    const resolved: Array<MatchVerdict | undefined> = lines.map(() => undefined);

    const keys = await Promise.all(
      lines.map((l) =>
        hashKey(
          `${l.line}|${l.size}|${l.category}|${l.candidates
            .map((c) => c.id)
            .sort()
            .join(",")}`,
        ),
      ),
    );

    const db = cacheClient();
    if (db) {
      const { data: cached } = await db
        .from("match_cache")
        .select("cache_key, product_id, confidence, reason")
        .in("cache_key", keys);
      for (const row of cached ?? []) {
        const index = keys.indexOf(row.cache_key as string);
        if (index >= 0) {
          resolved[index] = {
            productId: (row.product_id as string | null) ?? null,
            confidence: Number(row.confidence ?? 1),
            reason: String(row.reason ?? "cached"),
          };
        }
      }
    }

    const pending = lines
      .map((line, index) => ({ line, index }))
      .filter((x) => resolved[x.index] === undefined && x.line.candidates.length > 0);

    if (pending.length > 0) {
      const key = process.env["LOVABLE_API_KEY"];
      if (!key) throw new Error("AI service is not configured.");

      const payload = pending.map((x, i) => ({
        line_index: i,
        bill_line: x.line.line,
        bill_pack_size: x.line.size,
        bill_category: x.line.category,
        candidates: x.line.candidates.map((c) => ({ id: c.id, product: c.label })),
      }));

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          temperature: 0,
          top_p: 1,
          seed: 7,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(payload) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "verdicts", strict: true, schema },
          },
        }),
      });

      if (res.status === 429) throw new Error("Bahut requests ho gayi, thodi der baad try karein.");
      if (res.status === 402) throw new Error("AI credits khatam ho gaye hain.");
      if (!res.ok) throw new Error(`AI matching failed (${res.status})`);

      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(text) as {
        verdicts?: Array<{
          line_index: number;
          product_id: string | null;
          confidence: number;
          reason: string;
        }>;
      };

      const rows: Array<{
        cache_key: string;
        line_text: string;
        product_id: string | null;
        confidence: number;
        reason: string;
      }> = [];

      for (const v of parsed.verdicts ?? []) {
        const target = pending[v.line_index];
        if (!target) continue;
        const allowed = new Set(target.line.candidates.map((c) => c.id));
        const productId =
          v.product_id && allowed.has(v.product_id) && (v.confidence ?? 0) >= 0.5
            ? v.product_id
            : null;
        resolved[target.index] = {
          productId,
          confidence: v.confidence ?? 0,
          reason: v.reason ?? "",
        };
        const cacheKey = keys[target.index];
        if (cacheKey) {
          rows.push({
            cache_key: cacheKey,
            line_text: target.line.line,
            product_id: productId,
            confidence: v.confidence ?? 0,
            reason: v.reason ?? "",
          });
        }
      }

      if (db && rows.length > 0) {
        await db.from("match_cache").upsert(rows, { onConflict: "cache_key" });
      }
    }

    // null = no verdict for that line; the app keeps its deterministic pick.
    return lines.map((line, i) => {
      const r = resolved[i];
      if (r) return r;
      if (line.candidates.length === 0) {
        return { productId: null, confidence: 1, reason: "no candidates" };
      }
      return null;
    });
  });
