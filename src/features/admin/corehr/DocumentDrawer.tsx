import { useState } from "react";
import { saveFile } from "@/lib/fileStore";
import { FileViewer } from "./FileViewer";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { CheckIcon, FileIcon, UploadIcon, XIcon } from "@/components/icons";
import { EXPIRING_TYPES, daysUntil, documentAlert, updateDocument, type DocumentAction } from "@/lib/corehr/api";
import type { EmployeeDocument } from "@/lib/corehr/types";
import { documentTone, formatDate, inputClass, useActor } from "./format";
import type { ReactNode } from "react";
import { Detail, Drawer, ErrorNote, Field, Pill } from "./ui";

/** Same content as the drawer, laid out as a panel inside the page. */
function InlinePanel({ title, subtitle, footer, onClose, children }: { open: boolean; title: string; subtitle?: ReactNode; footer?: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <section aria-label={title} className="rise-in overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <div className="mt-0.5 text-xs text-ink-2">{subtitle}</div>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-ink-2 hover:bg-surface-2">
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="px-4 py-4">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-border bg-surface-2/40 px-4 py-2.5">{footer}</div>}
    </section>
  );
}

const MAX_BYTES = 10 * 1024 * 1024;

/** Everything HR does with one 201 document: upload, verify, return, replace, mark N/A. */
export function DocumentDrawer({ document: d, employeeName, onClose, inline }: { document: EmployeeDocument; employeeName: string; onClose: () => void; inline?: boolean }) {
  const Shell = inline ? InlinePanel : Drawer;
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "upload" | "return">(d.status === "Missing" ? "upload" : "view");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [referenceNo, setReferenceNo] = useState(d.referenceNo ?? "");
  const [expiresOn, setExpiresOn] = useState(d.expiresOn ?? "");
  const [note, setNote] = useState("");
  const tracksExpiry = EXPIRING_TYPES.includes(d.type);
  const alert = documentAlert(d);

  const [viewing, setViewing] = useState(false);
  const mutation = useMutation({
    mutationFn: async (action: DocumentAction) => {
      // Keep the file itself so it can be viewed later, not just its name.
      if (action.kind === "upload" && file) await saveFile(d.id, file);
      return updateDocument(d.id, action, actor);
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      const done = { upload: "Document uploaded", verify: "Document verified", return: "Returned for resubmission", "not-applicable": "Marked not applicable", required: "Marked as required" }[action.kind];
      toast.show(`${done} · ${d.type}`);
      onClose();
    },
  });

  function pick(f: File | undefined) {
    setFileError("");
    if (!f) return setFile(null);
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return setFileError("Use a PDF, JPG or PNG file");
    if (f.size > MAX_BYTES) return setFileError("Files can be up to 10 MB");
    setFile(f);
  }

  function upload() {
    if (!file) return setFileError("Choose a file");
    mutation.mutate({ kind: "upload", fileName: file.name, referenceNo, expiresOn });
  }

  const footer =
    mode === "upload" ? (
      <>
        <Button variant="ghost" onClick={() => (d.status === "Missing" ? onClose() : setMode("view"))}>
          Cancel
        </Button>
        <Button icon={<UploadIcon className="h-4 w-4" />} onClick={upload} disabled={mutation.isPending}>
          {mutation.isPending ? "Uploading…" : d.fileName ? "Replace file" : "Upload"}
        </Button>
      </>
    ) : mode === "return" ? (
      <>
        <Button variant="ghost" onClick={() => setMode("view")}>
          Back
        </Button>
        <Button variant="danger" onClick={() => mutation.mutate({ kind: "return", note })} disabled={mutation.isPending}>
          Return to employee
        </Button>
      </>
    ) : d.status === "Submitted" ? (
      <>
        <Button variant="ghost" onClick={() => setMode("return")}>
          Return
        </Button>
        <Button icon={<CheckIcon className="h-4 w-4" />} onClick={() => mutation.mutate({ kind: "verify" })} disabled={mutation.isPending}>
          Verify
        </Button>
      </>
    ) : d.status === "Not applicable" ? (
      <Button onClick={() => mutation.mutate({ kind: "required" })} disabled={mutation.isPending}>
        Mark as required
      </Button>
    ) : (
      <Button variant="ghost" icon={<UploadIcon className="h-4 w-4" />} onClick={() => setMode("upload")}>
        Replace file
      </Button>
    );

  return (
    <Shell
      open
      onClose={onClose}
      title={d.type}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          {employeeName} <Pill tone={documentTone[d.status]}>{d.status}</Pill>
          {alert && <Pill tone={alert === "expired" ? "crit" : "warn"}>{alert === "expired" ? "Expired" : `Expires in ${daysUntil(d.expiresOn!)} days`}</Pill>}
        </span>
      }
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        {d.note && d.status === "Missing" && <p className="rounded-lg bg-warning-tint px-3 py-2 text-sm text-warning">Returned: {d.note}</p>}

        {d.fileName && (
          <button type="button" onClick={() => setViewing(true)} title="View this file" className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-ink-3 hover:bg-surface-2/50">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-surface-2 text-ink-2">
              <FileIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{d.fileName}</p>
              <p className="text-xs text-ink-3">Uploaded {formatDate(d.uploadedAt)}</p>
            </div>
            <span className="flex-none rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold">View</span>
          </button>
        )}
        {viewing && d.fileName && <FileViewer documentId={d.id} fileName={d.fileName} title={d.type} ownerName={employeeName} uploadedAt={d.uploadedAt} onClose={() => setViewing(false)} />}

        {mode === "view" && d.status !== "Missing" && (
          <dl className="divide-y divide-border">
            {tracksExpiry && <Detail label="ID / reference no.">{d.referenceNo}</Detail>}
            {tracksExpiry && <Detail label="Expires">{d.expiresOn && formatDate(d.expiresOn)}</Detail>}
            {d.status === "Verified" && (
              <Detail label="Verified by">
                {d.verifiedBy} · {formatDate(d.verifiedAt)}
              </Detail>
            )}
          </dl>
        )}

        {mode === "upload" && (
          <div className="flex flex-col gap-4">
            <Field id="doc-file" label="File" required error={fileError} hint="PDF, JPG or PNG, up to 10 MB">
              <label
                htmlFor="doc-file"
                className={clsx("flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors hover:border-brand", fileError ? "border-critical" : "border-border")}
              >
                <UploadIcon className="h-5 w-5 text-ink-3" />
                <span className="text-sm font-medium">{file ? file.name : "Choose a file"}</span>
                <span className="text-xs text-ink-3">{file ? `${(file.size / 1024).toFixed(0)} KB` : "Scan or photo of the original"}</span>
              </label>
              <input id="doc-file" type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </Field>
            {tracksExpiry && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="doc-ref" label="ID / reference no.">
                  <input id="doc-ref" className={inputClass} value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
                </Field>
                <Field id="doc-exp" label="Expiry date" required={d.type !== "Police/Barangay Clearance"}>
                  <input id="doc-exp" type="date" className={inputClass} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
                </Field>
              </div>
            )}
            {d.status === "Missing" && (
              <button type="button" onClick={() => mutation.mutate({ kind: "not-applicable" })} className="self-start text-xs font-medium text-ink-2 underline underline-offset-2 hover:text-ink">
                This doesn't apply to {employeeName.split(" ")[0]}: mark not applicable
              </button>
            )}
          </div>
        )}

        {mode === "return" && (
          <Field id="doc-note" label="What needs fixing?" required hint="The employee sees this on their checklist.">
            <textarea id="doc-note" rows={3} autoFocus className={clsx(inputClass, "resize-y")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The scan is blurry; please upload a clearer copy." />
          </Field>
        )}

        <ErrorNote error={mutation.error} />
      </div>
    </Shell>
  );
}
