import { useAuth } from "@/features/auth/AuthContext";
import { documentAlert } from "@/lib/corehr/api";
import type { DocumentStatus, EmployeeDocument, EmploymentStatus } from "@/lib/corehr/types";

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/25 aria-[invalid=true]:border-critical disabled:bg-surface-2 disabled:text-ink-3";

/** Roomier, softer inputs for long forms like Add employee: filled, borderless until focused. */
export const softInputClass =
  "h-11 w-full rounded-xl border border-transparent bg-surface-2 px-3.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-border focus:border-brand focus:bg-surface focus-visible:ring-4 focus-visible:ring-brand/15 aria-[invalid=true]:border-critical aria-[invalid=true]:bg-critical-tint/40";

/** Compact pill-shaped controls for filter toolbars, sized to their content. */
export const filterSelectClass =
  "h-8 max-w-[12rem] flex-none cursor-pointer truncate rounded-full border border-border bg-surface pr-7 pl-3 text-xs font-medium text-ink-2 outline-none transition-colors hover:border-ink-3 focus-visible:border-brand";
export const filterSearchClass =
  "h-8 w-full rounded-full border border-border bg-surface pr-3 pl-8 text-xs text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-ink-3 focus:border-brand";

export function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
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
