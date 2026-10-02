export const peso = (n?: number) => (n === undefined ? "—" : `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0 })}`);

export function formatDate(iso?: string) {
  return iso ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—";
}
