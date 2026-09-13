export type Unit = "g" | "ml" | "unit";

export interface ScannedItem {
  id: string;
  name: string;
  qty: number; // pack size value, e.g. 500
  unit: Unit; // normalized unit
  count: number; // number of packs bought
  price: number; // total price paid in INR
  category: string; // lowercase category guess from the bill
  unclear: boolean;
}

export interface ScanResult {
  store: string;
  items: ScannedItem[];
}

export interface JustProduct {
  id: string;
  name: string;
  category: string;
  pack_qty: number;
  pack_unit: Unit;
  price: number;
  keywords: string[];
  active: boolean;
}

export type ComparisonStatus =
  | "just_cheaper"
  | "mart_cheaper"
  | "out_of_scope"
  | "unmatched";

export interface ComparisonRow {
  item: ScannedItem;
  match: JustProduct | null;
  justPrice: number | null;
  diff: number; // positive = saving with Just
  status: ComparisonStatus;
  label: string;
}

export interface ComparisonSummary {
  rows: ComparisonRow[];
  martTotal: number;
  justTotal: number;
  savings: number;
  savingsPct: number;
  matchedCount: number;
}
