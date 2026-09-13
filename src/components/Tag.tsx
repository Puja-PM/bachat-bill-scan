import type { ComparisonStatus } from "@/lib/types";

const styles: Record<ComparisonStatus, string> = {
  just_cheaper: "bg-success-soft text-success border-success/30",
  mart_cheaper: "bg-warning-soft text-warning-foreground border-warning/40",
  out_of_scope: "bg-neutral-tag text-neutral-tag-foreground border-border",
  unmatched: "bg-neutral-tag text-neutral-tag-foreground border-border",
};

export function Tag({ status, children }: { status: ComparisonStatus; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {children}
    </span>
  );
}
