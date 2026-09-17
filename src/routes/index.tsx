import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useMemo } from "react";
import QRCode from "react-qr-code";
import {
  Camera,
  Upload,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Settings,
  Sparkles,
} from "lucide-react";

import { scanReceipt } from "@/lib/scan.functions";
import { supabase } from "@/integrations/supabase/client";
import { compare, formatQty, rupees, shortlist } from "@/lib/compare";
import { resolveMatches } from "@/lib/match.functions";
import { Tag } from "@/components/Tag";
import type { JustProduct, ScannedItem } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JUST ke saath Grocery main Bachat" },
      {
        name: "description",
        content:
          "Scan a D-Mart, Star Bazaar or Reliance Fresh bill and show shoppers exactly how much they save with Just from Swiggy Instamart.",
      },
      { property: "og:title", content: "JUST ke saath Grocery main Bachat" },
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

type Step = "capture" | "scanning" | "pitch";

const APP_LINK = "https://www.swiggy.com/instamart";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File padha nahi gaya"));
    reader.readAsDataURL(file);
  });
}

// Phone photos are 4-8 MP; shrinking them before upload cuts scan time a lot
// while keeping receipt text readable.
const MAX_EDGE = 1600;

async function prepareFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) return fileToDataUrl(file);
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fileToDataUrl(file);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return fileToDataUrl(file);
  }
}

function ScannerApp() {
  const scan = useServerFn(scanReceipt);
  const resolve = useServerFn(resolveMatches);
  const [step, setStep] = useState<Step>("capture");
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState("D-Mart");
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [catalog, setCatalog] = useState<JustProduct[]>([]);
  const [resolved, setResolved] = useState<Array<string | null | undefined>>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => compare(items, catalog, resolved), [items, catalog, resolved]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setStep("scanning");
    try {
      const files = Array.from(fileList).slice(0, 4);
      const images = await Promise.all(files.map(prepareFile));
      const [result, catalogRes] = await Promise.all([
        scan({ data: { images } }),
        supabase.from("just_products").select("*").eq("active", true),
      ]);
      if (catalogRes.error) throw new Error(catalogRes.error.message);
      const products = (catalogRes.data ?? []) as unknown as JustProduct[];
      setCatalog(products);
      setStore(result.store);
      setItems(result.items);

      // Rules build a shortlist, a small model picks the like-for-like winner.
      // Any failure there just leaves the deterministic pick in place.
      try {
        const lines = result.items.map((item) => ({
          line: item.name,
          size: formatQty(item.qty * (item.count || 1), item.unit),
          category: item.category ?? "",
          candidates: shortlist(item, products).map((p) => ({
            id: String(p.id),
            label: `${p.name} — ${formatQty(Number(p.pack_qty), p.pack_unit)} @ ${rupees(Number(p.price))}`,
          })),
        }));
        const verdicts = await resolve({ data: { lines } });
        setResolved(verdicts.map((v) => (v ? v.productId : undefined)));
      } catch {
        setResolved([]);
      }
      setStep("pitch");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kuch galat ho gaya");
      setStep("capture");
    }
  }

  function reset() {
    setItems([]);
    setResolved([]);
    setStep("capture");
    setError(null);
  }




  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="bg-primary px-4 py-5 text-primary-foreground shadow-[var(--shadow-pop)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold leading-tight">
              JUST ke saath Grocery main Bachat
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

        {step === "pitch" && (
          <PitchScreen store={store} summary={summary} catalog={catalog} onReset={reset} />
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

function PitchScreen({
  store,
  summary,
  catalogCount,
  onReset,
}: {
  store: string;
  summary: ReturnType<typeof compare>;
  catalogCount: number;
  onReset: () => void;
}) {
  const [showQr, setShowQr] = useState(false);
  const topSavingRows = summary.rows
    .filter((row) => row.justPrice !== null && row.diff > 0)
    // Only the biggest JUST wins should be visible to the customer.
    .sort((a, b) => b.diff - a.diff);
  const visibleRows = topSavingRows.slice(0, 5);
  const hiddenSavingCount = Math.max(0, topSavingRows.length - visibleRows.length);
  const visibleSavings = visibleRows.reduce((total, row) => total + row.diff, 0);
  const visibleMartTotal = visibleRows.reduce((total, row) => total + row.item.price, 0);
  const visibleJustTotal = visibleRows.reduce((total, row) => total + (row.justPrice ?? 0), 0);
  const visibleSavingsPct = visibleMartTotal > 0 ? Math.round((visibleSavings / visibleMartTotal) * 100) : 0;
  const moreCatalogItems = Math.max(0, catalogCount - visibleRows.length);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl bg-secondary text-secondary-foreground shadow-[var(--shadow-pop)]">
        <div className="px-5 py-3 text-xs font-semibold uppercase opacity-80">
          Just Magarpatta / Hadapsar
        </div>
        <div className="bg-secondary-foreground/10 px-5 pb-6 text-center">
          <Sparkles className="mx-auto mb-1 h-7 w-7 text-accent" />
          <p className="font-display text-base font-bold uppercase">Top 5 JUST bachat</p>
          <div className="mt-1 flex flex-wrap items-end justify-center gap-3">
            <span className="font-display text-6xl font-extrabold leading-none">
              {rupees(visibleSavings)}
            </span>
            <span className="mb-2 rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
              {visibleSavingsPct}% OFF
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold opacity-90">
            Sirf sabse zyada saving wale items dikhaye gaye hain
          </p>
          <div className="mt-5 space-y-1 border-t border-secondary-foreground/20 pt-4 text-left text-sm">
            <Row label={`${store} total (top 5)`} value={rupees(visibleMartTotal)} />
            <Row label="Just app equivalent price" value={rupees(visibleJustTotal)} />
          </div>
        </div>
      </div>

      <h2 className="font-display text-lg font-bold">
        Top JUST savings ({visibleRows.length})
      </h2>

      <div className="space-y-3">
        {visibleRows.map((row) => (
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

      {visibleRows.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="font-display text-lg font-bold">Is bill par top savings nahi mili</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Naya bill scan karke Just ke cheaper items check karein.
          </p>
        </div>
      )}

      {(moreCatalogItems > 0 || hiddenSavingCount > 0) && (
        <section className="rounded-2xl border border-secondary/30 bg-success-soft p-5 text-success">
          <p className="font-display text-2xl font-extrabold leading-tight">
            {moreCatalogItems}+ aur grocery items JUST par available hain
          </p>
          <p className="mt-2 text-sm font-semibold">
            {hiddenSavingCount > 0
              ? `Is bill mein ${hiddenSavingCount} aur cheaper JUST match mile.`
              : "Atta, rice, oil, masale, soaps, detergent aur daily essentials par bhi bachat dekhein."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-4">
            <span className="rounded-full bg-card px-3 py-2 text-center">Atta &amp; Rice</span>
            <span className="rounded-full bg-card px-3 py-2 text-center">Oil &amp; Masale</span>
            <span className="rounded-full bg-card px-3 py-2 text-center">Soaps</span>
            <span className="rounded-full bg-card px-3 py-2 text-center">Cleaning</span>
          </div>
        </section>
      )}

      {showQr ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6">
          <p className="font-display text-lg font-bold">Scan karke Just order karein</p>
          <div className="rounded-xl bg-card p-3">
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
