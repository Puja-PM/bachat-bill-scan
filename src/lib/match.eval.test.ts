/**
 * Matching eval: every comparison the team has approved, plus pairings that must
 * never happen. Run with `bunx vitest run src/lib/match.eval.test.ts`.
 * Re-run this after ANY change to the matching rules or the judge prompt.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "vitest";
import { shortlist, formatQty, rupees } from "./compare";
import { judgeLines, type JudgeLine } from "./match.functions";
import type { JustProduct, ScannedItem } from "./types";

function envFile(name: string): string {
  const line = readFileSync(".env", "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^"|"$/g, "") : "";
}

type Case = {
  line: string;
  qty?: number;
  unit?: "g" | "ml" | "unit";
  /** Substring the chosen Just product name must contain. */
  expect: string | null;
  /** Substrings the chosen product must NOT contain. */
  forbid?: string[];
};

const CASES: Case[] = [
  { line: "L WADAKOLAM RICE", qty: 2510, unit: "g", expect: "Wada Kolam" },
  { line: "AASHIRVAAD ATTA 5KG", qty: 5000, unit: "g", expect: "Chakki", forbid: ["Multigrain", "Loose", "Pasta", "Nachni"] },
  { line: "AASHIRVAAD SHARBATI ATTA", qty: 5000, unit: "g", expect: "Sharbati" },
  { line: "VANDEVI B/P HIN-50g", qty: 50, unit: "g", expect: "Hing" },
  { line: "SAFFOLLA ACTIVE OIL 1L", qty: 1000, unit: "ml", expect: "Oil" },
  { line: "SAFFOLA GOLD OIL", qty: 1000, unit: "ml", expect: "Oil" },
  { line: "LIJJAT PAPAD 200g", qty: 200, unit: "g", expect: "Papad" },
  { line: "GODREJ N1 LEM -450g", qty: 450, unit: "g", expect: "Soap", forbid: ["Peas", "Pickle"] },
  { line: "LUX SOAP 100g", qty: 100, unit: "g", expect: "Soap" },
  { line: "MOTHERS RECIPE GINGR GARLIC", qty: 200, unit: "g", expect: "Ginger Garlic" },
  { line: "SURF EXCEL DETERGENT BAR", qty: 250, unit: "g", expect: "Bar", forbid: ["Powder"] },
  { line: "SURF EXCEL MATIC POWDER 1KG", qty: 1000, unit: "g", expect: "Powder", forbid: ["Bar"] },
  { line: "VIM DISHWASH BAR", qty: 300, unit: "g", expect: "Dishwash" },
  { line: "HARPIC TOILET CLEANER 500ML", qty: 500, unit: "ml", expect: "Toilet" },
  { line: "MDH JEERA POWDER 100g", qty: 100, unit: "g", expect: "Cumin" },
  { line: "MDH DHANIA POWDER 100g", qty: 100, unit: "g", expect: "Coriander", forbid: ["Coffee"] },
  { line: "PREMIA BADAM 500g", qty: 500, unit: "g", expect: "Almond" },
  { line: "TATA SALT 1KG", qty: 1000, unit: "g", expect: "Salt" },
  // Must never be compared at all.
  { line: "ODONIL AIR FRESHENER BLOCK", qty: 50, unit: "g", expect: null },
  { line: "EZEE LOCK CONTAINER 750ML", qty: 750, unit: "ml", expect: null },
];

function toItem(c: Case): ScannedItem {
  return {
    id: c.line,
    name: c.line,
    raw_line: c.line,
    qty: c.qty ?? 0,
    unit: c.unit ?? "unit",
    count: 1,
    price: 100,
    category: "grocery",
    unclear: false,
  } as ScannedItem;
}

let catalog: JustProduct[] = [];
let verdicts: Array<{ productId: string | null } | null> = [];

beforeAll(async () => {
  const url = envFile("SUPABASE_URL");
  const key = envFile("SUPABASE_PUBLISHABLE_KEY");
  const res = await fetch(
    `${url}/rest/v1/just_products?select=*&active=eq.true&limit=1000`,
    { headers: { apikey: key } },
  );
  catalog = (await res.json()) as JustProduct[];
  expect(catalog.length).toBeGreaterThan(100);

  const lines: JudgeLine[] = CASES.map((c) => {
    const item = toItem(c);
    return {
      line: c.line,
      size: formatQty(item.qty, item.unit),
      category: "grocery",
      candidates: shortlist(item, catalog).map((p) => ({
        id: String(p.id),
        label: `${p.name} — ${formatQty(Number(p.pack_qty), p.pack_unit)} @ ${rupees(Number(p.price))}`,
      })),
    };
  });

  verdicts = await judgeLines(lines, process.env["LOVABLE_API_KEY"] ?? "");
}, 180_000);

describe("approved Just comparisons", () => {
  CASES.forEach((c, i) => {
    it(`${c.line} -> ${c.expect ?? "not available"}`, () => {
      const id = verdicts[i]?.productId ?? null;
      const product = catalog.find((p) => String(p.id) === id);
      if (c.expect === null) {
        expect(product, `should not be matched, got ${product?.name}`).toBeUndefined();
        return;
      }
      expect(product, "no match picked").toBeTruthy();
      expect(product!.name.toLowerCase()).toContain(c.expect.toLowerCase());
      for (const bad of c.forbid ?? []) {
        expect(product!.name.toLowerCase()).not.toContain(bad.toLowerCase());
      }
    });
  });
});
