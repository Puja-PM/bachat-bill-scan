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
  "lock",
  "jar set",
  "flask",
  "cooker",
  "kadai",
  "tawa",
  // Block air-freshener blocks/bricks: the JUST equivalent is a spray, so the
  // comparison is not like-for-like.
  "odonil",
  "air freshener",
  "room freshener",
  "air fresh",
];

export function isOutOfScope(category: string, name = ""): boolean {
  const c = (category || "").toLowerCase();
  const n = (name || "").toLowerCase();
  // Dry fruits / nuts are packaged grocery, not fresh produce.
  if (/\bdry\b|\bnut/.test(c)) return OUT_OF_SCOPE_WORDS.some((x) => n.includes(x));
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
  "whole",
  "food",
  "grade",
  "active",
  "advanced",
  "natural",
  "pure",
  "original",
  "gentle",
  "refined",
  "select",
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
  hingraj: "hing",
  asafoetida: "hing",
  heeng: "hing",
  wheat: "atta",
  gehun: "atta",
  hin: "hing",
  hng: "hing",
  lem: "lime",
  nimbu: "lime",
  lemon: "lime",
  saffolla: "saffola",
  papadam: "papad",
  papd: "papad",
  gingr: "ginger",
  gngr: "ginger",
  adrak: "ginger",
  nuts: "nut",
  mixed: "mix",
  mothers: "mother",
};


// Bills glue words together ("WADAKOLAM"); split them before matching.
const GLUED: Record<string, string> = {
  wadakolam: "wada kolam",
  sonamasoori: "sona masoori",
  gingergarlic: "ginger garlic",
  kolamrice: "kolam rice",
  wholewheat: "whole atta",
};

// Brand names. Useful supporting evidence, but a shared brand alone never
// makes a match (Godrej soap must not pair with Godrej frozen peas).
const BRAND_WORDS = new Set([
  "godrej",
  "ezee",
  "lijjat",
  "vandevi",
  "saffola",
  "fortune",
  "aashirvaad",
  "tata",
  "amul",
  "nivea",
  "dettol",
  "lux",
  "dove",
  "santoor",
  "cinthol",
  "parachute",
  "harpic",
  "surf",
  "rin",
  "tide",
  "wheel",
  "real",
  "britannia",
  "nescafe",
  "sprite",
  "maggi",
  "colgate",
  "everest",
  "mdh",
  "oetker",
  "funfoods",
  "columbian",
  "mother",
  "recipe",
]);

// What a brand sells, for bill lines too short to state the product type
// ("SAFFOLLA ACTIVE" is cooking oil).
const BRAND_IMPLIES: Record<string, string> = {
  saffola: "oil",
  fortune: "oil",
  dhara: "oil",
  lijjat: "papad",
  harpic: "cleaner",
  colgate: "toothpaste",
  parachute: "oil",
};

// Generic product-type nouns: meaningful, but weak evidence on their own.
const TYPE_WORDS = new Set([
  "oil",
  "powder",
  "soap",
  "bar",
  "liquid",
  "detergent",
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
  "bread",
  "pasta",
  "bun",
  "rusk",
  "biscuits",
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
  // Packed bill lines should map to the packed JUST SKU, not the loose variant.
  "loose",
  // Oil varieties: a bill line that never says "mustard" should not land on
  // mustard oil; a generic oil maps to the blended oil instead.
  "mustard",
  "coconut",
  "olive",
  "groundnut",
  "soyabean",
  "sesame",
  "sunflower",
  "bran",
  // Flour varieties: plain atta means chakki atta, not multigrain or nachni.
  "multigrain",
  "nachni",
  "sharbati",
  "ragi",
  "jowar",
  "bajra",
  // Pasta shapes: a wheat atta bill line is not durum pasta.
  "durum",
  "penne",
  "fussili",
  "farfale",
  "rigate",
  "macaroni",
  "spaghetti",
]);

// Bill categories tell us the aisle even when the line is too cryptic to
// state a product type ("GODREJ N1 LEM" in personal care is a soap).
const PERSONAL_TYPES = new Set([
  "soap",
  "shampoo",
  "lotion",
  "toothpaste",
  "cream",
  "conditioner",
  "deodorant",
  "handwash",
  "brush",
  "sanitizer",
]);

const HOME_TYPES = new Set([
  "detergent",
  "cleaner",
  "dishwash",
  "sponge",
  "freshener",
  "foil",
  "tissue",
  "napkin",
]);

type Domain = "personal" | "home" | "food";

function domainOfCategory(category: string): Domain | null {
  const c = (category || "").toLowerCase();
  if (/personal|toiletr|cosmetic|beauty|bath|hygiene/.test(c)) return "personal";
  if (/home care|household|cleaning|laundry|detergent/.test(c)) return "home";
  if (/grocery|staple|spice|food|snack|oil|dairy|beverage|rice|atta/.test(c)) return "food";
  return null;
}

function domainOfWords(wordSet: Set<string>): Domain | null {
  for (const word of wordSet) if (HOME_TYPES.has(word)) return "home";
  for (const word of wordSet) if (PERSONAL_TYPES.has(word)) return "personal";
  for (const word of wordSet) if (TYPE_WORDS.has(word)) return "food";
  return null;
}

function words(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .flatMap((word) => (GLUED[word] ?? word).split(" "))
    .filter((word) => word.length > 2 && !/^\d+$/.test(word) && !MATCH_STOP_WORDS.has(word))
    .map((word) => SYNONYMS[word] ?? word);
  const implied = tokens.flatMap((word) => (BRAND_IMPLIES[word] ? [BRAND_IMPLIES[word]] : []));
  return [...tokens, ...implied];
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

function matchScore(itemName: string, phrase: string, productWords?: Set<string>): number {
  const itemWords = new Set(words(itemName));
  const phraseWords = new Set(words(phrase));
  if (itemWords.size === 0 || phraseWords.size === 0) return 0;

  // Product types are read from the whole product (name + keywords), so a
  // brand-only keyword like "Lux radiant Glow" still counts as a soap.
  const typeSource = productWords ?? phraseWords;

  // Different product types entirely (cooking oil vs handwash): never a match.
  const itemTypes = [...itemWords].filter((w) => TYPE_WORDS.has(w));
  const phraseTypes = [...typeSource].filter((w) => TYPE_WORDS.has(w));
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
  // Shared brand only, nothing about the product itself.
  if (shared.every((word) => BRAND_WORDS.has(word))) return 0;

  // The bill line states a product type the catalog item never mentions:
  // brand overlap only, so treat it as very weak evidence.
  const typeless = itemTypes.length > 0 && phraseTypes.length === 0;


  const strong = shared.filter((word) => !TYPE_WORDS.has(word) && !BRAND_WORDS.has(word)).length;
  const brand = shared.filter((word) => BRAND_WORDS.has(word)).length;
  const weak = shared.length - strong - brand;
  const coverage = shared.length / Math.min(itemWords.size, phraseWords.size);

  let score = strong * 1 + brand * 0.7 + weak * 0.4 + coverage * 0.5;

  // Penalise catalog-only speciality qualifiers the bill line never mentions.
  for (const word of phraseWords) {
    if (SPECIALITY_WORDS.has(word) && !itemWords.has(word)) score -= 0.8;
  }

  if (typeless) score *= 0.3;

  return score > 0.35 ? score : 0;
}


// Liquid groceries are printed by volume on bills but packed by weight in the
// Just catalog, so grams and millilitres are treated as comparable (1:1).
// Bill lines printed without a pack size (unit = "unit") must still compare:
// we allow them against any pack and simply ignore pack-size closeness.
function unitsComparable(_a: Unit, _b: Unit): boolean {
  return true;
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
    const productWords = new Set(words(phrases.join(" ")));
    // A personal-care bill line never pairs with a food SKU, and vice versa.
    const itemDomain = domainOfWords(new Set(words(item.name))) ?? domainOfCategory(item.category);
    const productDomain = domainOfWords(productWords);
    if (itemDomain && productDomain && itemDomain !== productDomain) continue;
    // A soap or cleaning line must land on a product that says what it is.
    if (itemDomain && itemDomain !== "food" && !productDomain) continue;
    const productForm = formOf(productWords);
    if (itemForm && productForm && itemForm !== productForm) continue;
    const base = Math.max(
      0,
      ...phrases.map((phrase) => matchScore(item.name, phrase, productWords)),
    );

    if (base === 0) continue;

    const sameFamily = unitFamily(p.pack_unit) === unitFamily(item.unit);
    let score = sameFamily ? base : base * 0.9;

    // A packed bill line belongs with the packed SKU, not the loose variant.
    const productText = phrases.join(" ").toLowerCase();
    if (productText.includes("loose") && !item.name.toLowerCase().includes("loose")) score -= 0.8;

    // The catalog keyword names the exact national brand on the bill
    // (Lux -> Rose Glow Beauty Soap): the strongest signal we have.
    const itemBrands = [...new Set(words(item.name))].filter((w) => BRAND_WORDS.has(w));
    if (itemBrands.some((b) => productWords.has(b))) score += 0.6;

    // Bill says "paste"/"bar"/"spray" but the catalog item states no form:
    // weaker evidence than a catalog item stating the same form.
    if (itemForm && !productForm) score -= 0.6;

    if (score <= 0) continue;
    // No printed pack size on the bill: ignore pack-size closeness entirely.
    const sizeless = unitFamily(item.unit) === "count" || unitFamily(p.pack_unit) === "count";
    candidates.push({
      product: p,
      score,
      sizeGap: sizeless ? 0 : Math.abs(p.pack_qty - totalQty),
    });

  }
  // Among equally good names, prefer the closest pack size. The final id
  // tie-break keeps the chosen match identical across repeat scans.
  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      a.sizeGap / (totalQty || 1) - b.sizeGap / (totalQty || 1) ||
      String(a.product.id).localeCompare(String(b.product.id)),
  );
  const best = candidates[0];
  if (!best) return null;
  // Re-rank the near-best names by pack-size closeness so 5 kg atta maps to the
  // 5 kg pack rather than a 1 kg one.
  const close = candidates.filter((c) => c.score >= best.score - 0.25);
  close.sort(
    (a, b) =>
      a.sizeGap - b.sizeGap ||
      b.score - a.score ||
      String(a.product.id).localeCompare(String(b.product.id)),
  );
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
