import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useMemo } from "react";
import QRCode from "react-qr-code";
import {
  Camera,
  Upload,
  Loader2,
  Trash2,
  Plus,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Settings,
} from "lucide-react";

import { scanReceipt } from "@/lib/scan.functions";
import { supabase } from "@/integrations/supabase/client";
import { compare, formatQty, rupees } from "@/lib/compare";
import { Tag } from "@/components/Tag";
import type { JustProduct, ScannedItem, Unit } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Just Bill Bachat Scanner — D-Mart Bill Compare" },
      {
        name: "description",
        content:
          "Scan a D-Mart, Star Bazaar or Reliance Fresh bill and show shoppers exactly how much they save with Just from Swiggy Instamart.",
      },
      { property: "og:title", content: "Just Bill Bachat Scanner" },
      {
        property: "og:description",
        content: "Instant receipt scan aur bachat pitch for Just private-label groceries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScannerApp,
});

type Step = "capture" | "scanning" | "verify" | "pitch";

const APP_LINK = "https://www.swiggy.com/instamart";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File padha nahi gaya"));
    reader.readAsDataURL(file);
  });
}

function ScannerApp() {
  const scan = useServerFn(scanReceipt);
  const [step, setStep] = useState<Step>("capture");
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState("D-Mart");
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [catalog, setCatalog] = useState<JustProduct[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => compare(items, catalog), [items, catalog]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setStep("scanning");
    try {
      const files = Array.from(fileList).slice(0, 4);
      const images = await Promise.all(files.map(fileToDataUrl));
      const [result, catalogRes] = await Promise.all([
        scan({ data: { images } }),
        supabase.from("just_products").select("*").eq("active", true),
      ]);
      if (catalogRes.error) throw new Error(catalogRes.error.message);
      setCatalog((catalogRes.data ?? []) as unknown as JustProduct[]);
      setStore(result.store);
      setItems(result.items);
      setStep("verify");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kuch galat ho gaya");
      setStep("capture");
    }
  }

  function update(id: string, patch: Partial<ScannedItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function reset() {
    setItems([]);
    setStep("capture");
    setError(null);
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="bg-primary px-4 py-5 text-primary-foreground shadow-[var(--shadow-pop)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold leading-tight">
              Just Bill Bachat Scanner
            </h1>
            <p className="text-xs opacity-85">Magarpatta &amp; Hadapsar · Swiggy Instamart</p>
          </div>
          <Link
            to="/catalog"
            className="rounded-full border border-primary-foreground/30 p-2 transition-colors hover:bg-primary-foreground/10"
            aria-label="Just catalog manage karein"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "capture" && (
          <CaptureScreen
            onCamera={() => cameraRef.current?.click()}
            onGallery={() => galleryRef.current?.click()}
          />
        )}

        {step === "scanning" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="font-display text-xl font-bold">Bill scan ho raha hai...</p>
            <p className="text-sm text-muted-foreground">
              Har item padha ja raha hai, bas 10-15 second.
            </p>
          </div>
        )}

        {step === "verify" && (
          <VerifyScreen
            store={store}
            items={items}
            onChange={update}
            onRemove={(id) => setItems((p) => p.filter((i) => i.id !== id))}
            onAdd={() =>
              setItems((p) => [
                ...p,
                {
                  id: `manual-${Date.now()}`,
                  name: "",
                  qty: 1,
                  unit: "unit",
                  count: 1,
                  price: 0,
                  category: "grocery",
                  unclear: false,
                },
              ])
            }
            onBack={reset}
            onSubmit={() => setStep("pitch")}
          />
        )}

        {step === "pitch" && (
          <PitchScreen store={store} summary={summary} onReset={reset} />
        )}
      </main>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

function CaptureScreen({ onCamera, onGallery }: { onCamera: () => void; onGallery: () => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-24 w-16 items-end justify-center rounded-md border-2 border-border bg-muted">
          <div className="mb-2 h-1.5 w-10 rounded bg-border" />
        </div>
        <h2 className="font-display text-xl font-bold">Customer ka bill scan karein</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Poora bill frame mein rakhein. Lamba bill ho toh 2-3 overlapping photo ek saath bhejein.
        </p>
      </div>

      <button
        onClick={onCamera}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-secondary px-6 py-5 font-display text-lg font-bold text-secondary-foreground shadow-[var(--shadow-pop)] transition-transform active:scale-[0.98]"
      >
        <Camera className="h-6 w-6" /> D-Mart Bill Scan Karein
      </button>

      <button
        onClick={onGallery}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary bg-card px-6 py-4 font-display text-base font-bold text-primary transition-colors hover:bg-primary/5"
      >
        <Upload className="h-5 w-5" /> Gallery Se Bill Upload Karein
      </button>

      <p className="text-center text-xs text-muted-foreground">
        PNG, JPG ya PDF — sab chalega. Star Bazaar aur Reliance Fresh bills bhi.
      </p>
    </div>
  );
}

const UNITS: Unit[] = ["g", "ml", "unit"];

function VerifyScreen({
  store,
  items,
  onChange,
  onRemove,
  onAdd,
  onBack,
  onSubmit,
}: {
  store: string;
  items: ScannedItem[];
  onChange: (id: string, patch: Partial<ScannedItem>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold">Review Parsed Bill ({store})</h2>
        <p className="text-sm text-muted-foreground">
          {items.length} items — 5 second mein check karein, phir pitch banayein.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-2xl border bg-card p-3 ${
              item.unclear ? "border-warning/60 bg-warning-soft" : "border-border"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                value={item.name}
                placeholder="Item ka naam"
                onChange={(e) => onChange(item.id, { name: e.target.value, unclear: false })}
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium outline-none focus:border-primary"
              />
              <button
                onClick={() => onRemove(item.id)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                aria-label="Item hatayein"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <LabeledInput
                label="Qty"
                value={item.qty}
                onChange={(v) => onChange(item.id, { qty: Number(v) || 0 })}
              />
              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Unit
                </span>
                <select
                  value={item.unit}
                  onChange={(e) => onChange(item.id, { unit: e.target.value as Unit })}
                  className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <LabeledInput
                label="Packs"
                value={item.count}
                onChange={(v) => onChange(item.id, { count: Number(v) || 1 })}
              />
              <LabeledInput
                label="₹ Price"
                value={item.price}
                onChange={(v) => onChange(item.id, { price: Number(v) || 0 })}
              />
            </div>
            <input
              value={item.category}
              onChange={(e) => onChange(item.id, { category: e.target.value.toLowerCase() })}
              placeholder="category"
              className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground outline-none focus:border-primary"
            />
            {item.unclear && (
              <p className="mt-2 text-xs font-semibold text-warning-foreground">
                Unclear Item — agent verify karein
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" /> Add Missing Item
      </button>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
        >
          Wapas
        </button>
        <button
          onClick={onSubmit}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 font-display text-base font-bold text-secondary-foreground"
        >
          Generate Comparison Pitch <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function PitchScreen({
  store,
  summary,
  onReset,
}: {
  store: string;
  summary: ReturnType<typeof compare>;
  onReset: () => void;
}) {
  const [showQr, setShowQr] = useState(false);
  const positive = summary.savings >= 0;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-pop)]">
        <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wide opacity-80">
          Just Magarpatta / Hadapsar
        </div>
        <div className="bg-primary-foreground/5 px-5 pb-5">
          <p className="font-display text-sm font-bold uppercase tracking-wide">
            Aapki total bachat with Just
          </p>
          <div className="flex items-end gap-3">
            <span className="font-display text-5xl font-extrabold">
              {rupees(Math.abs(summary.savings))}
            </span>
            <span className="mb-2 rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
              {Math.abs(summary.savingsPct)}% {positive ? "OFF" : "ZYADA"}
            </span>
          </div>
          <p className="text-xs opacity-85">
            {positive ? "Is bill par direct savings" : "Is bill par Just thoda mehenga nikla"}
          </p>
          <div className="mt-4 space-y-1 border-t border-primary-foreground/20 pt-3 text-sm">
            <Row label={`${store} total (matched items)`} value={rupees(summary.martTotal)} />
            <Row label="Just app equivalent price" value={rupees(summary.justTotal)} />
          </div>
        </div>
      </div>

      <h2 className="font-display text-lg font-bold">
        Item breakdown ({summary.rows.length} items scanned)
      </h2>

      <div className="space-y-3">
        {summary.rows.map((row) => (
          <div key={row.item.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex justify-between gap-3 text-sm">
              <span className="font-semibold uppercase text-muted-foreground">MART</span>
              <span className="flex-1 font-medium">
                {row.item.name} ({formatQty(row.item.qty, row.item.unit)}
                {row.item.count > 1 ? ` × ${row.item.count}` : ""})
              </span>
              <span className="font-bold">{rupees(row.item.price)}</span>
            </div>
            {row.match && row.justPrice !== null && (
              <div className="mt-1 flex justify-between gap-3 text-sm">
                <span className="font-semibold uppercase text-secondary">JUST</span>
                <span className="flex-1 font-medium">
                  {row.match.name} (Equal {formatQty(row.item.qty * row.item.count, row.item.unit)})
                </span>
                <span className="font-bold">{rupees(row.justPrice)}</span>
              </div>
            )}
            <div className="mt-2">
              <Tag status={row.status}>{row.label}</Tag>
            </div>
          </div>
        ))}
      </div>

      {showQr ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6">
          <p className="font-display text-lg font-bold">Scan karke Just order karein</p>
          <div className="rounded-xl bg-white p-3">
            <QRCode value={APP_LINK} size={168} />
          </div>
          <p className="text-xs text-muted-foreground">Swiggy Instamart · Just private label</p>
        </div>
      ) : (
        <button
          onClick={() => setShowQr(true)}
          className="w-full rounded-2xl bg-secondary px-6 py-5 font-display text-lg font-bold text-secondary-foreground shadow-[var(--shadow-pop)]"
        >
          Install Just App &amp; Claim Savings
        </button>
      )}

      <button
        onClick={onReset}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground"
      >
        <RotateCcw className="h-4 w-4" /> Naya Bill Scan Karein
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="opacity-85">{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
