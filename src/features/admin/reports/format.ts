import type { ColumnKind } from "@/lib/reports/api";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const plain = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

export function formatValue(v: string | number, kind: ColumnKind = "text") {
  if (typeof v !== "number") return v;
  if (kind === "money") return peso.format(v);
  if (kind === "percent") return `${plain.format(v)}%`;
  return plain.format(v);
}

/** Short peso amount for tiles: "₱1.2M", "₱845K". */
export function shortPeso(v: number) {
  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `₱${Math.round(v / 1_000)}K`;
  return peso.format(v);
}
