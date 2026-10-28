// The 201 file's papers on the backend: what each person has, the review steps (an employee uploads, HR verifies or
// returns it, or marks a paper not applicable / required), and the files themselves. Shaped like the in-browser Core HR
// documents so the 201 screens work unchanged. Papers are keyed by the backend document id, or "<employee no>-<TYPE>"
// for one not uploaded yet.

import type { DocumentAction, ServerDocumentAction } from "../corehr/api";
import type { DocumentType, EmployeeDocument } from "../corehr/types";
import type { PersonnelDocument } from "../types";
import { api, backendBase, getToken } from "./client";

/** Backend paper types shown on the website's checklist (the backend's other papers aren't listed there). */
export const DOCUMENT_TYPE: Record<string, DocumentType> = {
  RESUME: "Application Form / Resume",
  BIRTH_CERTIFICATE: "Birth Certificate (PSA)",
  MARRIAGE_CERTIFICATE: "Marriage Certificate (PSA)",
  CHILD_BIRTH_CERTIFICATE: "Child's Birth Certificate",
  GOVERNMENT_ID: "Valid Government ID",
  DIPLOMA_TOR: "Diploma / Transcript of Records",
  PROFESSIONAL_LICENSE: "Professional License",
  PREVIOUS_COE: "Certificate of Employment (Previous)",
  NBI_CLEARANCE: "NBI Clearance",
  POLICE_CLEARANCE: "Police/Barangay Clearance",
  MEDICAL_RESULTS: "Pre-Employment Medical Result",
};

interface BackendPaper {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string | null;
  expiresOn: string | null;
  referenceNo: string | null;
  notes: string | null;
  reviewStatus?: "SUBMITTED" | "VERIFIED";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface BackendChecklistItem {
  type: string;
  status: "ON_FILE" | "MISSING" | "EXPIRED" | "EXPIRING" | "NOT_NEEDED" | "NONE_YET" | "AUTOMATIC";
  expiresOn: string | null;
  note?: string | null;
  override?: "NOT_APPLICABLE" | "REQUIRED" | null;
  documents: BackendPaper[];
}

/** What the website needs to act on a paper later: whose it is, its backend type and HR's decision on it. */
const meta = new Map<string, { employeeNo: string; backendEmployeeId?: string; type: string; override: BackendChecklistItem["override"] }>();

/** Files picked on the 201 screens, waiting to be sent with the upload action (lib/fileStore.ts saveFile). */
const pending = new Map<string, File>();
export const stashFile = (id: string, file: File) => void pending.set(id, file);

/** One person's checklist as the website's documents. */
export function mapPapers(employeeNo: string, items: BackendChecklistItem[], backendEmployeeId?: string): EmployeeDocument[] {
  return items.flatMap((item) => {
    const type = DOCUMENT_TYPE[item.type];
    if (!type) return [];
    // An upload waiting for HR is what needs attention, even if an older checked copy exists.
    const doc = item.documents.find((d) => d.reviewStatus === "SUBMITTED") ?? item.documents[0];
    const status: EmployeeDocument["status"] =
      item.status === "NOT_NEEDED" ? "Not applicable" : doc?.reviewStatus === "SUBMITTED" ? "Submitted" : doc ? "Verified" : "Missing";
    const id = doc?.id ?? `${employeeNo}-${item.type}`;
    meta.set(id, { employeeNo, backendEmployeeId, type: item.type, override: item.override ?? null });
    return [
      {
        id,
        employeeId: employeeNo,
        type,
        status,
        fileName: doc?.fileName,
        uploadedAt: doc?.uploadedAt,
        ...(doc?.reviewStatus !== "SUBMITTED" && doc ? { verifiedBy: doc.reviewedBy ?? doc.uploadedBy ?? undefined, verifiedAt: doc.reviewedAt ?? doc.uploadedAt } : {}),
        referenceNo: doc?.referenceNo ?? undefined,
        expiresOn: doc?.expiresOn ?? item.expiresOn ?? undefined,
        note: (status === "Missing" ? item.note : doc?.notes) ?? undefined,
      },
    ];
  });
}

/** The 201 documents page: everyone's papers (HR and the Super Admin). */
export async function backendAllPapers(): Promise<EmployeeDocument[]> {
  const rows = await api<{ employeeNo: string; items: BackendChecklistItem[] }[]>("/documents/papers");
  return rows.flatMap((r) => mapPapers(r.employeeNo, r.items));
}

/** The signed-in person's own papers (Employee › 201 File). */
export async function backendMyPapers(employeeNo: string): Promise<PersonnelDocument[]> {
  const file = await api<{ items: BackendChecklistItem[] }>("/me/201-file");
  return mapPapers(employeeNo, file.items).map((d) => ({ id: d.id, employeeId: d.employeeId, type: d.type, status: d.status, fileName: d.fileName, uploadedOn: d.uploadedAt?.slice(0, 10), idExpiry: d.expiresOn, licenseExpiry: d.expiresOn, ...(d.status === "Missing" && d.note ? { returnNote: d.note } : {}) }));
}

/** A multipart upload with the signed-in session (the JSON client can't send files). */
async function sendFile(path: string, type: string, file: File, extra: { referenceNo?: string; expiresOn?: string } = {}) {
  const form = new FormData();
  form.set("type", type);
  if (extra.referenceNo?.trim()) form.set("referenceNo", extra.referenceNo.trim());
  if (extra.expiresOn) form.set("expiresOn", extra.expiresOn);
  form.set("file", file);
  const token = getToken();
  const res = await fetch(`${backendBase()}${path}`, { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const issue = body && Array.isArray(body.issues) ? body.issues[0]?.message : undefined;
    throw new Error(issue || body?.message || "Couldn't upload the file. Try again.");
  }
  return body as { id: string };
}

function metaOf(id: string) {
  const m = meta.get(id);
  if (!m) throw new Error("Reload the page and try again.");
  return m;
}

/**
 * One action on a paper. Uploading: the employee's own goes to HR for review; HR's own is added as checked. Verify and
 * return work on an upload waiting for review; not applicable / required record HR's decision for this person.
 */
/** Whose paper it is and its backend type (for reloading it after an action). */
export const paperInfo = (id: string) => meta.get(id);

export async function backendDocumentAction(id: string, action: DocumentAction | ServerDocumentAction, me: string | undefined, backendEmployeeId: (employeeNo: string) => Promise<string | null>) {
  const m = metaOf(id);
  const mine = !!me && m.employeeNo === me;
  const employeeBackendId = async () => m.backendEmployeeId ?? (await backendEmployeeId(m.employeeNo));
  switch (action.kind) {
    case "upload": {
      const file = pending.get(id);
      if (!file) throw new Error("Choose the file again, then upload.");
      if (mine) await sendFile("/me/documents", m.type, file, action);
      else {
        const eid = await employeeBackendId();
        if (!eid) throw new Error("That employee no longer exists");
        await sendFile(`/employees/${eid}/documents`, m.type, file, action);
      }
      pending.delete(id);
      return;
    }
    case "verify":
      await api(`/documents/${id}/verify`, { method: "POST" });
      return;
    case "return":
      await api(`/documents/${id}/return`, { method: "POST", body: { note: action.note } });
      return;
    case "not-applicable":
    case "required": {
      const eid = await employeeBackendId();
      if (!eid) throw new Error("That employee no longer exists");
      // "Required" undoes a not-applicable mark, or makes a paper the usual rule skips required for this person.
      const state = action.kind === "not-applicable" ? "NOT_APPLICABLE" : m.override === "NOT_APPLICABLE" ? null : "REQUIRED";
      await api(`/employees/${eid}/201-file/${m.type}`, { method: "PUT", body: { state } });
      return;
    }
    case "withdraw":
      await api(`/me/documents/${id}`, { method: "DELETE" });
      return;
    default:
      throw new Error("That isn't available yet.");
  }
}

/** Opens a paper's file (every opening is recorded on the backend). */
export async function backendOpenFile(id: string): Promise<{ blob: Blob; name: string; type: string; savedAt: string } | null> {
  const token = getToken();
  const res = await fetch(`${backendBase()}/documents/${encodeURIComponent(id)}/file`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  if (!res.ok) return null;
  const blob = await res.blob();
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(res.headers.get("content-disposition") ?? "")?.[1];
  return { blob, name: name ? decodeURIComponent(name) : "document", type: blob.type, savedAt: "" };
}
