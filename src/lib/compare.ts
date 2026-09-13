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

export function findMatch(item: ScannedItem, catalog: JustProduct[]): JustProduct | null {
  const name = item.name.toLowerCase();
  let best: JustProduct | null = null;
  let bestLen = 0;
  for (const p of catalog) {
    if (!p.active) continue;
    if (unitFamily(p.pack_unit) !== unitFamily(item.unit)) continue;
    for (const kw of p.keywords) {
      const k = kw.toLowerCase().trim();
      if (k.length > 2 && name.includes(k) && k.length > bestLen) {
        best = p;
        bestLen = k.length;
      }
    }
  }
  return best;
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
