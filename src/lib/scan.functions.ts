import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ScanInput = z.object({
  images: z.array(z.string().min(20)).min(1).max(4),
});

const SYSTEM_PROMPT = `You read Indian hypermarket receipts (D-Mart, Star Bazaar, Reliance Fresh, etc.), often faded thermal prints.
Extract every purchased line item. Rules:
- name: the printed item description, cleaned up (brand + product).
- raw_line: ONLY the printed quantity/unit fragment from the line (e.g. "1 KG", "500 ML", "2 N"). Keep it under 12 characters. Empty string if none printed.
- qty: the pack size number only (e.g. 500 for "500 ML", 5 for "5 KG", 1 for loose/unit items).
- unit: normalize to "g" (grams; convert kg -> g), "ml" (millilitres; convert L -> ml) or "unit" (pieces, apparel, unlabelled packs).
- count: how many packs of that line were bought (default 1).
- price: the TOTAL amount paid for that line in rupees (after discount), as a number.
- category: a short lowercase category, e.g. "edible oil", "staples", "pulses", "spices", "beverages", "home care", "personal care", "packaged food", "dry fruits", "apparel", "vegetable", "fruit", "electronics", "toy", "dairy".
- unclear: true when the text is too faded/ambiguous to trust.
Ignore totals, taxes, savings lines, bill numbers and payment rows. Return only real items.
Also return the store name as printed (e.g. "D-Mart Magarpatta").`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["store", "items"],
  properties: {
    store: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "raw_line", "qty", "unit", "count", "price", "category", "unclear"],
        properties: {
          name: { type: "string" },
          raw_line: { type: "string" },
          qty: { type: "number" },
          unit: { type: "string", enum: ["g", "ml", "unit"] },
          count: { type: "number" },
          price: { type: "number" },
          category: { type: "string" },
          unclear: { type: "boolean" },
        },
      },
    },
  },
} as const;

export const scanReceipt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ScanInput.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI service is not configured.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        service_tier: "priority",
        temperature: 0,
        top_p: 1,
        seed: 7,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all items from this receipt (multiple photos may be parts of one long bill).",
              },
              ...data.images.map((url) => ({ type: "image_url", image_url: { url } })),
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "receipt", strict: true, schema },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("Bahut requests! Thodi der baad try karein.");
      if (res.status === 402)
        throw new Error("AI credits khatam ho gaye. Workspace mein credits add karein.");
      throw new Error(`Bill scan fail hua (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as {
      store?: string;
      items?: Array<Record<string, unknown>>;
    };

    return {
      store: parsed.store || "Hypermarket Bill",
      items: (parsed.items ?? []).map((raw, i) => {
        const rawLine = String(raw["raw_line"] ?? raw["name"] ?? "");
        const unit = (["g", "ml", "unit"].includes(String(raw["unit"]))
          ? raw["unit"]
          : "unit") as "g" | "ml" | "unit";
        let qty = Number(raw["qty"]) > 0 ? Number(raw["qty"]) : 1;
        if (unit === "g" && /\bkgs?\b/i.test(rawLine) && qty < 100) qty *= 1000;
        if (unit === "ml" && /\b(?:l|lt|ltr|ltrs|litre|liter)s?\b/i.test(rawLine) && qty < 100)
          qty *= 1000;
        return {
          id: `item-${i}-${Math.random().toString(36).slice(2, 8)}`,
          name: String(raw["name"] ?? "Unknown Item"),
          qty,
          unit,
          count: Number(raw["count"]) > 0 ? Number(raw["count"]) : 1,
          price: Number(raw["price"]) || 0,
          category: String(raw["category"] ?? "grocery").toLowerCase(),
          unclear: Boolean(raw["unclear"]),
        };
      }),
    };
  });
