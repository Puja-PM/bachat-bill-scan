import type {
  ComparisonRow,
  ComparisonSummary,
  JustProduct,
  ScannedItem,
  Unit,
} from "./types";

export const EXCLUDED_CATEGORIES = [
  "apparel",
  "clothing",
  "garment",
  "footwear",
  "vegetable",
  "fruit",
  "fresh produce",
  "electronics",
  "appliance",
  "toy",
  "stationery",
  "kitchenware",
  "utensil",
  "luggage",
  "furniture",
];

export function isOutOfScope(category: string): boolean {
  const c = (category || "").toLowerCase();
  return EXCLUDED_CATEGORIES.some((x) => c.includes(x));
}

function unitFamily(u: Unit): "weight" | "volume" | "count" {
  if (u === "g") return "weight";
  if (u === "ml") return "volume";
  return "count";
}

const MATCH_STOP_WORDS = new Set([
  "and",
  "with",
  "the",
  "for",
  "of",
  "plus",
  "pack",
  "pouch",
  "refill",
  "new",
  "fresh",
]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 2 && !MATCH_STOP_WORDS.has(word));
}

function matchScore(itemName: string, phrase: string): number {
  const itemWords = new Set(words(itemName));
  const phraseWords = new Set(words(phrase));
  if (itemWords.size === 0 || phraseWords.size === 0) return 0;

  const overlap = [...phraseWords].filter((word) => itemWords.has(word)).length;
  const coverage = overlap / Math.min(itemWords.size, phraseWords.size);
  const enoughEvidence = overlap >= 2 || (overlap === 1 && phraseWords.size === 1);
  return enoughEvidence && coverage >= 0.6 ? coverage + overlap * 0.05 : 0;
}

// Liquid groceries are printed by volume on bills but packed by weight in the
// Just catalog, so grams and millilitres are treated as comparable (1:1).
function unitsComparable(a: Unit, b: Unit): boolean {
  const fa = unitFamily(a);
  const fb = unitFamily(b);
  if (fa === fb) return true;
  return fa !== "count" && fb !== "count";
}

export function findMatch(item: ScannedItem, catalog: JustProduct[]): JustProduct | null {
  const candidates: Array<{ product: JustProduct; score: number; sizeGap: number }> = [];
  const totalQty = item.qty * (item.count || 1);
  for (const p of catalog) {
    if (!p.active) continue;
    if (!unitsComparable(p.pack_unit, item.unit)) continue;
    const base = Math.max(0, ...p.keywords.map((keyword) => matchScore(item.name, keyword)));
    if (base === 0) continue;
    const sameFamily = unitFamily(p.pack_unit) === unitFamily(item.unit);
    candidates.push({
      product: p,
      score: sameFamily ? base : base * 0.9,
      sizeGap: Math.abs(p.pack_qty - totalQty),
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.sizeGap - b.sizeGap);
  return candidates[0]?.product ?? null;
}

export function formatQty(qty: number, unit: Unit): string {
  if (unit === "unit") return `${qty} unit`;
  if (unit === "g" && qty >= 1000) return `${+(qty / 1000).toFixed(2)} kg`;
  if (unit === "ml" && qty >= 1000) return `${+(qty / 1000).toFixed(2)} L`;
  return `${qty} ${unit}`;
}

export function rupees(n: number): string {
  return `₹${n.toFixed(2)}`;
}

export function compare(items: ScannedItem[], catalog: JustProduct[]): ComparisonSummary {
  const rows: ComparisonRow[] = items.map((item) => {
    if (isOutOfScope(item.category)) {
      return {
        item,
        match: null,
        justPrice: null,
        diff: 0,
        status: "out_of_scope",
        label: "Yeh Category Just Pe Available Nahi Hai",
      };
    }

    const match = findMatch(item, catalog);
    if (!match) {
      return {
        item,
        match: null,
        justPrice: null,
        diff: 0,
        status: "unmatched",
        label: "Abhi Just Catalog Mein Available Nahi",
      };
    }

    const totalQty = item.qty * (item.count || 1);
    const justPrice = +((match.price / match.pack_qty) * totalQty).toFixed(2);
    const diff = +(item.price - justPrice).toFixed(2);

    if (diff >= 0) {
      return {
        item,
        match,
        justPrice,
        diff,
        status: "just_cheaper",
        label: `Aapne Bachaye ${rupees(diff)} (Mart Se Sasta!)`,
      };
    }
    return {
      item,
      match,
      justPrice,
      diff,
      status: "mart_cheaper",
      label: `Mart Pe ${rupees(Math.abs(diff))} Sasta Hai`,
    };
  });

  const matched = rows.filter((r) => r.justPrice !== null);
  const martTotal = +matched.reduce((s, r) => s + r.item.price, 0).toFixed(2);
  const justTotal = +matched.reduce((s, r) => s + (r.justPrice ?? 0), 0).toFixed(2);
  const savings = +(martTotal - justTotal).toFixed(2);
  const savingsPct = martTotal > 0 ? Math.round((savings / martTotal) * 100) : 0;

  return {
    rows,
    martTotal,
    justTotal,
    savings,
    savingsPct,
    matchedCount: matched.length,
  };
}
