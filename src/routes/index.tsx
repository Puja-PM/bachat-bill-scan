import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useMemo } from "react";

import {
  Upload,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Settings,
  Sparkles,
  MapPin,
  ScanLine,
  Share2,
  Coins,
} from "lucide-react";

import scanAssistant from "@/assets/bill-scan-assistant.png";
import savingsCelebration from "@/assets/savings-celebration.png";
import { Button } from "@/components/ui/button";
import { scanReceipt } from "@/lib/scan.functions";
import { supabase } from "@/integrations/supabase/client";
import { toPng } from "html-to-image";
import { compare, formatQty, rupees, shortlist } from "@/lib/compare";
import { resolveMatches } from "@/lib/match.functions";
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

const APP_LINK =
  "https://play.google.com/store/apps/details?id=in.jusshop.android.just";


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
        <header className="bg-[image:var(--header-gradient)] px-5 py-6 text-primary-foreground shadow-[var(--shadow-pop)] sm:py-7">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-display text-xl font-extrabold leading-tight sm:text-2xl">
                JUST ke saath Grocery main Bachat
              </p>
              <p className="flex items-center gap-1.5 text-sm font-medium opacity-85">
                <MapPin className="h-4 w-4 shrink-0" /> Magarpatta &amp; Hadapsar
              </p>
            </div>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-12 w-12 shrink-0 rounded-xl border border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground shadow-[var(--shadow-pop)] hover:bg-primary-foreground/20 hover:text-primary-foreground"
            >
              <Link to="/catalog" aria-label="Just catalog manage karein">
                <Settings className="h-6 w-6" />
              </Link>
            </Button>
          </div>
        </header>

      <main className={step === "capture" ? "mx-auto max-w-3xl px-4 pb-6 pt-5 sm:px-6 sm:pb-8" : "mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8"}>
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
      <section className="overflow-hidden rounded-[2rem] border border-card bg-card px-5 pb-7 pt-2 text-center shadow-[var(--shadow-scan-panel)] sm:px-10 sm:pb-9">
        <img
          src={scanAssistant}
          alt="Bill scan karne mein madad karti Just assistant"
          width={1024}
          height={768}
          className="mx-auto h-auto w-full max-w-md object-contain"
        />
        <h2 className="font-display text-[1.65rem] font-extrabold leading-tight sm:text-3xl">
          Customer ka bill scan karein
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[0.98rem] leading-relaxed text-muted-foreground sm:text-lg">
          Poora bill frame mein rakhein. Lamba bill ho toh 2-3 overlapping photo ek saath bhejein.
        </p>
      </section>

      <Button
        type="button"
        onClick={onCamera}
        className="h-auto w-full rounded-[1.6rem] bg-secondary px-6 py-5 font-display text-xl font-extrabold text-secondary-foreground shadow-[var(--shadow-scan-action)] transition-transform hover:bg-secondary/90 active:scale-[0.98] sm:py-6 sm:text-2xl"
      >
        <ScanLine className="h-7 w-7" /> D-Mart Bill Scan Karein
      </Button>

      <Button
        type="button"
        variant="outline"
        onClick={onGallery}
        className="h-auto w-full rounded-[1.6rem] border-2 border-primary bg-card px-5 py-4 font-display text-lg font-extrabold text-primary shadow-none hover:bg-primary/5 hover:text-primary sm:py-5 sm:text-xl"
      >
        <Upload className="h-5 w-5" /> Gallery Se Bill Upload Karein
      </Button>

      <p className="px-2 text-center text-sm leading-relaxed text-muted-foreground">
        PNG, JPG ya PDF — sab chalega. Star Bazaar aur Reliance Fresh bills bhi.
      </p>
    </div>
  );
}

function PitchScreen({
  store,
  summary,
  catalog,
  onReset,
}: {
  store: string;
  summary: ReturnType<typeof compare>;
  catalog: JustProduct[];
  onReset: () => void;
}) {
  const [sharing, setSharing] = useState(false);

  const pitchRef = useRef<HTMLDivElement>(null);
  const topSavingRows = summary.rows
    .filter((row) => row.justPrice !== null && row.diff > 0)
    // Only the biggest JUST wins should be visible to the customer.
    .sort((a, b) => b.diff - a.diff);
  const visibleRows = topSavingRows.slice(0, 5);
  
  const visibleSavings = visibleRows.reduce((total, row) => total + row.diff, 0);
  const visibleMartTotal = visibleRows.reduce((total, row) => total + row.item.price, 0);
  const visibleJustTotal = visibleRows.reduce((total, row) => total + (row.justPrice ?? 0), 0);
  const visibleSavingsPct = visibleMartTotal > 0 ? Math.round((visibleSavings / visibleMartTotal) * 100) : 0;
  const moreCatalogItems = Math.max(0, catalog.length - visibleRows.length);
  // Show real JUST product names from the price list instead of a vague count.
  const shownIds = new Set(visibleRows.map((row) => String(row.match?.id ?? "")));
  const otherProducts = Array.from(
    new Map(
      catalog
        .filter((p) => !shownIds.has(String(p.id)))
        .map((p) => {
          const clean = p.name.replace(/^jus\+?\s*/i, "").trim();
          return [clean.toLowerCase(), clean] as const;
        }),
    ).values(),
  ).slice(0, 14);

  // Snapshot the pitch page as an image and share it via WhatsApp's
  // native share sheet; fall back to downloading the image.
  async function shareSavings() {
    if (sharing || !pitchRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(pitchRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#f9f9f6",
        // Keep action buttons out of the shared image.
        filter: (node) =>
          !(node instanceof HTMLElement && node.hasAttribute("data-snapshot-hide")),
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "just-bachat.png", { type: "image/png" });
      const text = `Maine JUST ke saath grocery mein ${rupees(visibleSavings)} bachaye! 🎉`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "JUST Bachat", text });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "just-bachat.png";
        link.click();
      }
    } catch {
      // User cancelled the share sheet or capture failed — nothing to fix.
    } finally {
      setSharing(false);
    }
  }

  return (
    <div ref={pitchRef} className="space-y-5 pb-5">
      <section className="savings-stage relative overflow-hidden rounded-2xl border-2 border-accent bg-[image:var(--savings-gradient)] text-secondary-foreground shadow-[var(--shadow-savings)]">
        <div className="relative z-10 px-5 py-3 text-xs font-extrabold uppercase tracking-normal opacity-90">
          Just Magarpatta / Hadapsar
        </div>
        <div className="relative z-10 px-5 pb-5 pt-3 text-center sm:px-8 sm:pb-7">
          <div className="relative mx-auto min-h-44 sm:min-h-52">
            <div className="relative z-10 pr-[34%] pt-5 sm:pr-[32%]">
              <Sparkles className="mx-auto mb-1 h-7 w-7 text-accent" />
              <p className="font-display text-base font-extrabold uppercase">Top 5 JUST bachat</p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <span className="savings-amount font-display text-4xl font-extrabold leading-none sm:text-7xl">
              {rupees(visibleSavings)}
                </span>
                <span className="rounded-full bg-accent px-3 py-1 text-sm font-extrabold text-accent-foreground shadow-sm">
                  {visibleSavingsPct}% OFF
                </span>
              </div>
            </div>
            <img
              src={savingsCelebration}
              alt="JUST savings celebrate karti hui assistant"
              width={816}
              height={816}
              className="pointer-events-none absolute -bottom-5 -right-8 block w-44 object-contain sm:-bottom-8 sm:-right-12 sm:w-64"
            />
          </div>
          <p className="relative z-20 mt-1 text-sm font-bold opacity-95">
            Sirf sabse zyada saving wale items dikhaye gaye hain
          </p>
          <div className="relative z-20 mt-5 space-y-1 border-t border-secondary-foreground/25 pt-4 text-left text-sm sm:text-base">
            <Row label={`${store} total (top 5)`} value={rupees(visibleMartTotal)} />
            <Row label="Just app equivalent price" value={rupees(visibleJustTotal)} />
          </div>
        </div>
      </section>

      <h2 className="flex items-center gap-2 font-display text-xl font-extrabold">
        Top JUST savings ({visibleRows.length}) <Coins className="h-5 w-5 text-warning" />
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {visibleRows.map((row) => (
          <article key={row.item.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card-soft)]">
            <div className="px-4 pb-3 pt-4 text-center">
              <p className="savings-card-amount font-display text-4xl font-extrabold leading-none">
                {rupees(row.diff)}
              </p>
              <p className="mt-1 font-display text-sm font-extrabold uppercase text-primary">Grocery bachat</p>
            </div>
            <div className="flex min-h-24 items-center gap-3 px-4 pb-3">
              <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-lg bg-success-soft font-display text-xl font-extrabold text-success">
                J+
              </div>
              <div className="min-w-0 text-left">
                <p className="line-clamp-2 text-sm font-bold uppercase">{row.item.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {row.match?.name} (Equal {formatQty(row.item.qty * row.item.count, row.item.unit)})
                </p>
              </div>
            </div>
            <div className="mx-4 flex items-center justify-between border-t border-border py-3 text-sm">
              <span>Mart <strong>{rupees(row.item.price)}</strong></span>
              <span className="text-secondary">JUST <strong>{rupees(row.justPrice ?? 0)}</strong></span>
            </div>
          </article>
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

      {otherProducts.length > 0 && (
        <section className="rounded-2xl border border-secondary/30 bg-success-soft p-5 text-success">
          <p className="font-display text-xl font-extrabold leading-tight">
            JUST par aur bhi bahut kuch
          </p>
          <p className="mt-1 text-sm font-semibold">{moreCatalogItems}+ products available — jaise ki:</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            {otherProducts.map((name) => (
              <span key={name} className="rounded-full bg-card px-3 py-2">
                {name}
              </span>
            ))}
          </div>
        </section>
      )}

      <Button
        type="button"
        data-snapshot-hide
        onClick={() =>
          window.open(APP_LINK, "_blank", "noopener,noreferrer")
        }
        className="h-auto w-full rounded-xl bg-primary px-6 py-4 font-display text-lg font-extrabold text-primary-foreground shadow-[var(--shadow-pop)] hover:bg-primary/90"
      >
        Install Just App &amp; Claim Savings
      </Button>


      <Button
        type="button"
        data-snapshot-hide
        onClick={shareSavings}
        disabled={sharing}
        className="h-auto w-full rounded-none bg-secondary px-6 py-4 font-display text-lg font-extrabold uppercase text-secondary-foreground hover:bg-secondary/90"
      >
        {sharing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />} Share your bachat
      </Button>

      <Button
        type="button"
        data-snapshot-hide
        variant="ghost"
        onClick={onReset}
        className="h-auto w-full rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground"
      >
        <RotateCcw className="h-4 w-4" /> Naya Bill Scan Karein
      </Button>
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
