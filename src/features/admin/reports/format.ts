import type { ColumnKind } from "@/lib/reports/api";
import { fmtDay } from "@/lib/preferences";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const plain = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 });

export function formatValue(v: string | number, kind: ColumnKind = "text") {
  // Dates (2026-10-08) show in the date format chosen in Settings; files keep the ISO date.
  if (typeof v !== "number") return /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDay(v) : v;
  if (kind === "money") return peso.format(v);
  if (kind === "percent") return `${plain.format(v)}%`;
  return plain.format(v);
}
