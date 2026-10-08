import { useAuth } from "@/features/auth/AuthContext";
import { documentAlert } from "@/lib/corehr/api";
import type { DocumentStatus, EmployeeDocument, EmploymentStatus } from "@/lib/corehr/types";
import { fmtDate, fmtDay } from "@/lib/preferences";

export const inputClass =
  "field w-full px-3 py-2 text-sm";

/** Roomier, softer inputs for long forms like Add employee: filled, borderless until focused. */
export const softInputClass =
  "field h-11 w-full px-3.5 text-sm aria-[invalid=true]:bg-critical-tint/40";

/** Compact pill-shaped controls for filter toolbars, sized to their content. */
export const filterSelectClass =
  "chip-filter h-8 max-w-[12rem] flex-none cursor-pointer truncate pr-7 pl-3 text-xs font-medium";
export const filterSearchClass =
  "chip-filter h-8 w-full pr-3 pl-8 text-xs";

export function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Calendar days keep their date; moments follow the person's timezone. Both use their date format.
  return iso.length === 10 ? fmtDay(iso) : fmtDate(d);
}

/** "3 yrs 2 mos" since an ISO date. */
export function tenure(iso: string) {
  const start = new Date(`${iso}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months--;
  if (months < 1) return "New this month";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} yr${y > 1 ? "s" : ""}`, m && `${m} mo${m > 1 ? "s" : ""}`].filter(Boolean).join(" ");
}

/** Keeps the last four digits: "••••-•••-1234". */
export function mask(value: string) {
  if (!value) return "";
  let seen = 0;
  const keep = 4;
  const total = value.replace(/\D/g, "").length;
  return value.replace(/\d/g, (d) => (++seen > total - keep ? d : "•"));
}

export type Tone = "good" | "warn" | "crit" | "neutral" | "info";

export const statusTone: Record<EmploymentStatus, Tone> = { Active: "good", "On leave": "info", Suspended: "warn", Separated: "neutral" };
export const documentTone: Record<DocumentStatus, Tone> = { Verified: "good", Submitted: "info", Missing: "crit", "Not applicable": "neutral" };

/** The signed-in HR user's name, recorded on every change. */
export function useActor() {
  const { user } = useAuth();
  return user?.name ?? "HR";
}

export const keys = {
  employees: ["corehr", "employees"] as const,
  employee: (id: string) => ["corehr", "employee", id] as const,
  units: ["corehr", "units"] as const,
  positions: ["corehr", "positions"] as const,
  documents: ["corehr", "documents"] as const,
  events: (id: string) => ["corehr", "events", id] as const,
  audit: (id: string) => ["corehr", "audit", id] as const,
};

/** What a document's status means for HR, in plain words. */
export function documentState(d: EmployeeDocument) {
  const alert = documentAlert(d);
  if (alert === "expired") return { label: "Expired, ask for a new one", tone: "crit" as const };
  if (alert === "expiring") return { label: "Expiring soon", tone: "warn" as const };
  if (d.status === "Submitted") return { label: "Uploaded, needs checking", tone: "info" as const };
  if (d.status === "Missing") return { label: d.note ? "Sent back, waiting" : "Not submitted yet", tone: "crit" as const };
  if (d.status === "Verified") return { label: "Checked", tone: documentTone.Verified };
  return { label: "Doesn't apply", tone: "neutral" as const };
}
