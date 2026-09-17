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

// Non-grocery hardware the bill's own category often mislabels (e.g. a
// storage container printed as "kitchen"). Blocked by name too.
const OUT_OF_SCOPE_WORDS = [
  "container",
  "lunch box",
  "tiffin",
  "casserole",
  "bowl set",
  "bucket",
  "mug",
  "plate",
  "hanger",
  "broom",
  "mop stick",
  "storage box",
  "jar set",
  "flask",
  "cooker",
  "kadai",
  "tawa",
];

export function isOutOfScope(category: string, name = ""): boolean {
  const c = (category || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (EXCLUDED_CATEGORIES.some((x) => c.includes(x))) return true;
  return OUT_OF_SCOPE_WORDS.some((x) => n.includes(x));
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
  "jus",
  "pack",
  "pouch",
  "packet",
  "refill",
  "bottle",
  "box",
  "new",
  "fresh",
  "premium",
  "combo",
  "loose",
  "classic",
  "special",
  "quality",
  "value",
  "daily",
  "select",
  "super",
  "extra",
  "gold",
  "regular",
  "food",
  "grade",
  "active",
  "advanced",
  "natural",
  "pure",
  "original",
  "gentle",
]);


// Hindi / English names for the same product, plus common bill spellings.
const SYNONYMS: Record<string, string> = {
  dhania: "coriander",
  dhaniya: "coriander",
  jeera: "cumin",
  zeera: "cumin",
  haldi: "turmeric",
  mirch: "chilli",
  mirchi: "chilli",
  chili: "chilli",
  chilly: "chilli",
  namak: "salt",
  cheeni: "sugar",
  chini: "sugar",
  sarso: "mustard",
  sarson: "mustard",
  tel: "oil",
  chana: "chickpea",
  channa: "chickpea",
  kabuli: "chickpea",
  maida: "flour",
  aata: "atta",
  gehu: "atta",
  wheat: "atta",
  besan: "gramflour",
  kaju: "cashew",
  badam: "almond",
  almonds: "almond",
  cashews: "cashew",
  kishmish: "raisin",
  raisins: "raisin",
  detergents: "detergent",
  washing: "detergent",
  dishwash: "dishwash",
  dishwashing: "dishwash",
  utensil: "dishwash",
  scrubber: "sponge",
  scrub: "sponge",
  noodle: "noodles",
  soaps: "soap",
  bathing: "soap",
  seeds: "seed",
  powdered: "powder",
  masoor: "lentil",
  toor: "tur",
  arhar: "tur",
};

// Generic product-type nouns: meaningful, but weak evidence on their own.
const TYPE_WORDS = new Set([
  "oil",
  "powder",
  "soap",
  "bar",
  "liquid",
  "detergent",
  "atta",
  "flour",
  "seed",
  "mix",
  "cleaner",
  "wash",
  "noodles",
  "biscuit",
  "cookies",
  "tea",
  "coffee",
  "sugar",
  "salt",
  "water",
  "juice",
  "dal",
  "rice",
  "sponge",
  "whole",
  "cream",
  "lotion",
  "shampoo",
  "paste",
  "sauce",
  "ghee",
  "milk",
  "butter",
  "spray",
  "gel",
  "handwash",
  "sanitizer",
  "toothpaste",
  "brush",
  "foil",
  "tissue",
  "napkin",
  "freshener",
  "conditioner",
  "deodorant",
  "honey",
  "jam",
  "pickle",
  "masala",
]);

// Pack form: a detergent bar is not a detergent powder, even though both are
// detergent. When both sides state a form and the forms differ, it is a miss.
const FORM_WORDS = new Set([
  "bar",
  "cake",
  "powder",
  "liquid",
  "gel",
  "spray",
  "paste",
  "cream",
  "wipes",
  "granules",
]);


// Specialised qualifiers: if the catalog item has them and the bill line does
// not, it is almost certainly a different product (e.g. pooja oil vs cooking oil).
const SPECIALITY_WORDS = new Set([
  "pooja",
  "puja",
  "camphor",
  "hair",
  "massage",
  "baby",
  "toilet",
  "bathroom",
  "floor",
  "glass",
  "car",
  "pet",
  "phenyl",
  "bleaching",
  "agarbatti",
  "incense",
]);

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 2 && !MATCH_STOP_WORDS.has(word))
    .map((word) => SYNONYMS[word] ?? word);
}

function formOf(wordSet: Set<string>): string | null {
  for (const word of wordSet) {
    if (!FORM_WORDS.has(word)) continue;
    if (word === "cake") return "bar";
    if (word === "granules") return "powder";
    return word;
  }
  return null;
}

function matchScore(itemName: string, phrase: string): number {
  const itemWords = new Set(words(itemName));
  const phraseWords = new Set(words(phrase));
  if (itemWords.size === 0 || phraseWords.size === 0) return 0;

  // Different product types entirely (cooking oil vs handwash): never a match.
  const itemTypes = [...itemWords].filter((w) => TYPE_WORDS.has(w));
  const phraseTypes = [...phraseWords].filter((w) => TYPE_WORDS.has(w));
  if (
    itemTypes.length > 0 &&
    phraseTypes.length > 0 &&
    !itemTypes.some((w) => phraseTypes.includes(w))
  ) {
    return 0;
  }

  // Same product, different pack form (detergent bar vs detergent powder).
  const itemForm = formOf(itemWords);
  const phraseForm = formOf(phraseWords);
  if (itemForm && phraseForm && itemForm !== phraseForm) return 0;

  const shared = [...phraseWords].filter((word) => itemWords.has(word));
  if (shared.length === 0) return 0;

  const strong = shared.filter((word) => !TYPE_WORDS.has(word)).length;
  const weak = shared.length - strong;
  const coverage = shared.length / Math.min(itemWords.size, phraseWords.size);

  let score = strong * 1 + weak * 0.4 + coverage * 0.5;

  // Penalise catalog-only speciality qualifiers the bill line never mentions.
  for (const word of phraseWords) {
    if (SPECIALITY_WORDS.has(word) && !itemWords.has(word)) score -= 0.8;
  }

  return score > 0.35 ? score : 0;
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
  const itemForm = formOf(new Set(words(item.name)));
  for (const p of catalog) {
    if (!p.active) continue;
    if (!unitsComparable(p.pack_unit, item.unit)) continue;
    const phrases = [...p.keywords, p.name];
    // A detergent bar must map to a bar, not to the powder or the liquid.
    const productForm = formOf(new Set(words(phrases.join(" "))));
    if (itemForm && productForm && itemForm !== productForm) continue;
    const base = Math.max(0, ...phrases.map((phrase) => matchScore(item.name, phrase)));
    if (base === 0) continue;

    const sameFamily = unitFamily(p.pack_unit) === unitFamily(item.unit);
    candidates.push({
      product: p,
      score: sameFamily ? base : base * 0.9,
      sizeGap: Math.abs(p.pack_qty - totalQty),
    });
  }
  // Among equally good names, prefer the closest pack size.
  candidates.sort(
    (a, b) => b.score - a.score || a.sizeGap / (totalQty || 1) - b.sizeGap / (totalQty || 1),
  );
  const best = candidates[0];
  if (!best) return null;
  // Re-rank the near-best names by pack-size closeness so 5 kg atta maps to the
  // 5 kg pack rather than a 1 kg one.
  const close = candidates.filter((c) => c.score >= best.score - 0.25);
  close.sort((a, b) => a.sizeGap - b.sizeGap || b.score - a.score);
  return close[0]?.product ?? best.product;
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
    if (isOutOfScope(item.category, item.name)) {
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
