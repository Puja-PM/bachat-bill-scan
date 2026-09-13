import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { JustProduct } from "@/lib/types";

export const Route = createFileRoute("/catalog")({
  head: () => ({
    meta: [
      { title: "Just Catalog Manager — Bill Bachat Scanner" },
      {
        name: "description",
        content: "Just private-label products aur unke pack prices add ya update karein.",
      },
      { property: "og:title", content: "Just Catalog Manager" },
      {
        property: "og:description",
        content: "Manage the Just product list and prices used for bill comparisons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const [rows, setRows] = useState<JustProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    void load();
    return () => sub.subscription.unsubscribe();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("just_products").select("*").order("name");
    if (error) setMsg(error.message);
    setRows((data ?? []) as unknown as JustProduct[]);
    setLoading(false);
  }

  async function save(row: JustProduct) {
    const { id, ...rest } = row;
    const payload = {
      name: rest.name,
      category: rest.category,
      pack_qty: rest.pack_qty,
      pack_unit: rest.pack_unit,
      price: rest.price,
      keywords: rest.keywords,
      active: rest.active,
    };
    const { error } = id.startsWith("new-")
      ? await supabase.from("just_products").insert(payload)
      : await supabase.from("just_products").update(payload).eq("id", id);
    setMsg(error ? error.message : "Saved!");
    if (!error) void load();
  }

  async function remove(row: JustProduct) {
    if (row.id.startsWith("new-")) {
      setRows((p) => p.filter((r) => r.id !== row.id));
      return;
    }
    const { error } = await supabase.from("just_products").delete().eq("id", row.id);
    setMsg(error ? error.message : "Deleted");
    if (!error) void load();
  }

  function patch(id: string, p: Partial<JustProduct>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="bg-primary px-4 py-5 text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link to="/" className="rounded-full p-2 hover:bg-primary-foreground/10">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-xl font-extrabold">Just Catalog Manager</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {msg && (
          <p className="mb-4 rounded-xl border border-border bg-card px-4 py-2 text-sm">{msg}</p>
        )}
        {!signedIn && <SignIn onDone={() => setMsg("Signed in — ab prices edit kar sakte hain")} />}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-border bg-card p-3">
                <input
                  value={row.name}
                  onChange={(e) => patch(row.id, { name: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
                />
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <Field
                    label="Pack qty"
                    value={row.pack_qty}
                    onChange={(v) => patch(row.id, { pack_qty: Number(v) || 0 })}
                  />
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Unit
                    </span>
                    <select
                      value={row.pack_unit}
                      onChange={(e) =>
                        patch(row.id, { pack_unit: e.target.value as JustProduct["pack_unit"] })
                      }
                      className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                    >
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="unit">unit</option>
                    </select>
                  </div>
                  <Field
                    label="₹ Price"
                    value={row.price}
                    onChange={(v) => patch(row.id, { price: Number(v) || 0 })}
                  />
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Category
                    </span>
                    <input
                      value={row.category}
                      onChange={(e) => patch(row.id, { category: e.target.value })}
                      className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
                    />
                  </div>
                </div>
                <input
                  value={row.keywords.join(", ")}
                  onChange={(e) =>
                    patch(row.id, {
                      keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                    })
                  }
                  placeholder="matching keywords, comma separated"
                  className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
                />
                <div className="mt-3 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={(e) => patch(row.id, { active: e.target.checked })}
                    />
                    Active
                  </label>
                  <button
                    onClick={() => void save(row)}
                    disabled={!signedIn}
                    className="ml-auto flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" /> Save
                  </button>
                  <button
                    onClick={() => void remove(row)}
                    disabled={!signedIn}
                    className="rounded-lg p-2 text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() =>
                setRows((p) => [
                  {
                    id: `new-${Date.now()}`,
                    name: "",
                    category: "grocery",
                    pack_qty: 1000,
                    pack_unit: "g",
                    price: 0,
                    keywords: [],
                    active: true,
                  },
                  ...p,
                ])
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-4 w-4" /> Naya Just product add karein
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-input bg-background px-2 py-2 text-sm"
      />
    </div>
  );
}

function SignIn({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(mode: "in" | "up") {
    setBusy(true);
    setErr(null);
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/catalog` },
          });
    setBusy(false);
    if (error) setErr(error.message);
    else onDone();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">Team login</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Prices edit karne ke liye login karein. Bina login ke bhi catalog dekh sakte hain.
      </p>
      <div className="mt-3 space-y-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        {err && <p className="text-xs text-destructive">{err}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => void submit("in")}
            disabled={busy}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            Login
          </button>
          <button
            onClick={() => void submit("up")}
            disabled={busy}
            className="flex-1 rounded-lg border border-primary px-4 py-2 text-sm font-bold text-primary disabled:opacity-50"
          >
            Naya account
          </button>
        </div>
      </div>
    </div>
  );
}
