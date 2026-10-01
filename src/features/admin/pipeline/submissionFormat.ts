import type { OnboardingSubmission } from "@/lib/types";

/** Distinct 201 files a submission includes (a scanned ID counts once). */
export const submittedFileCount = (s: OnboardingSubmission) =>
  new Set([...(s.input.uploadedDocuments ?? []).map((u) => u.type), ...(s.input.governmentId ? ["Valid Government ID"] : [])]).size;

export function formatSubmitted(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-PH", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}`;
}
