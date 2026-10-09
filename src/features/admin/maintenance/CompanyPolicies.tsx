import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { PlusIcon } from "@/components/icons";
import { saveFile } from "@/lib/fileStore";
import { acknowledgementsFor, deletePolicy, listPolicies, openPolicyFile, POLICY_CATEGORIES, savePolicy, setPolicyStatus, type PolicyCategory, type PolicyInput, type PolicyRow } from "@/lib/policies";
import { useCan } from "@/lib/useCan";
import { SimpleTable } from "../timekeeping/common";
import { inputClass, useActor } from "../corehr/format";
import { Drawer, ErrorNote, Field, LoadError, Pill } from "../corehr/ui";

const KEY = ["policies"] as const;
const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function PolicyDialog({ row, onClose }: { row?: PolicyRow; onClose: () => void }) {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState<PolicyInput>(row ? { ...row } : { title: "", category: "Employee handbook", effectiveDate: today, summary: "", body: "", requireAck: true });
  const [file, setFile] = useState<File | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      let input = d;
      if (file) {
        const fileId = `policy-${Date.now().toString(36)}`;
        await saveFile(fileId, file);
        input = { ...d, fileId, fileName: file.name };
      }
      return savePolicy(input, actor);
    },
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: KEY });
      toast.show(row && p.version > row.version ? `Saved as version ${p.version}. Everyone needs to acknowledge it again.` : "Policy saved.");
      onClose();
    },
  });
  return (
    <Dialog
      open
      onClose={onClose}
      title={row ? `Edit ${row.title}` : "Add a policy"}
      size="lg"
      dismissOnBackdrop={false}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {row?.status === "published" && <p className="rounded-lg bg-warning-tint px-3 py-2 text-xs">This policy is published. Changing its title, text or document makes a new version, and everyone has to acknowledge it again.</p>}
        <Field id="po-title" label="Title">
          <input id="po-title" className={inputClass} value={d.title} placeholder="e.g. Code of Conduct" onChange={(e) => setD({ ...d, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="po-cat" label="Category">
            <select id="po-cat" className={inputClass} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as PolicyCategory })}>
              {POLICY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field id="po-eff" label="Takes effect">
            <input id="po-eff" type="date" className={inputClass} value={d.effectiveDate} onChange={(e) => setD({ ...d, effectiveDate: e.target.value })} />
          </Field>
        </div>
        <Field id="po-sum" label="Summary" hint="One or two lines employees see in the list.">
          <input id="po-sum" className={inputClass} value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} />
        </Field>
        <Field id="po-body" label="Policy text" hint="Write it here, attach the document below, or both.">
          <textarea id="po-body" rows={8} className={inputClass} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
        </Field>
        <Field id="po-file" label="Document (optional)" hint={d.fileName ? `Attached: ${d.fileName}. Choose another file to replace it.` : "PDF or Word file."}>
          <input id="po-file" type="file" accept=".pdf,.doc,.docx,application/pdf" className={inputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.requireAck} onChange={(e) => setD({ ...d, requireAck: e.target.checked })} /> Employees must confirm they have read it
        </label>
        <ErrorNote error={save.error} />
      </div>
    </Dialog>
  );
}

function AcksDrawer({ row, onClose }: { row: PolicyRow; onClose: () => void }) {
  const acks = useQuery({ queryKey: [...KEY, "acks", row.id, row.version], queryFn: () => acknowledgementsFor(row.id) });
  return (
    <Drawer open onClose={onClose} title={row.title} subtitle={`Version ${row.version} · ${row.acknowledged} of ${row.total} have read it`}>
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="mb-2 text-sm font-semibold">Not yet ({acks.data?.waiting.length ?? 0})</h3>
          {acks.data?.waiting.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {acks.data.waiting.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-2">Everyone has read it.</p>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Read and confirmed ({acks.data?.done.length ?? 0})</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {acks.data?.done.map((a) => (
              <li key={a.name} className="flex justify-between gap-2">
                <span>{a.name}</span>
                <span className="text-xs text-ink-2">{shortDate(a.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Drawer>
  );
}

/** Maintenance → Rules: company policies employees read and acknowledge. */
export function CompanyPolicies() {
  const toast = useToast();
  const actor = useActor();
  const queryClient = useQueryClient();
  const canEdit = useCan("edit", "rules");
  const list = useQuery({ queryKey: KEY, queryFn: listPolicies, staleTime: 0 });
  const [editing, setEditing] = useState<PolicyRow | "new" | null>(null);
  const [viewing, setViewing] = useState<PolicyRow | null>(null);
  const done = (m: string) => (queryClient.invalidateQueries({ queryKey: KEY }), toast.show(m));
  const status = useMutation({ mutationFn: ({ r, s }: { r: PolicyRow; s: PolicyRow["status"] }) => setPolicyStatus(r.id, s, actor), onSuccess: (_v, { r, s }) => done(s === "published" ? `${r.title} is published. Employees can read it now.` : s === "archived" ? `${r.title} archived.` : "Saved.") });
  const remove = useMutation({ mutationFn: (r: PolicyRow) => deletePolicy(r.id), onSuccess: () => done("Draft deleted."), onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't delete.", "critical") });
  if (list.isError) return <LoadError onRetry={() => list.refetch()} />;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Company policies</h2>
          <p className="text-[13px] text-ink-2">Publish policies for employees to read, and see who has confirmed reading each one.</p>
        </div>
        {canEdit && (
          <Button icon={<PlusIcon className="h-4 w-4" />} onClick={() => setEditing("new")}>
            Add policy
          </Button>
        )}
      </div>
      <SimpleTable
        rows={list.data ?? []}
        rowKey={(r) => r.id}
        loading={list.isLoading}
        empty="No policies yet. Add the employee handbook or code of conduct to start."
        cols={[
          {
            header: "Policy",
            cell: (r) => (
              <span>
                <span className="block font-medium">{r.title}</span>
                {r.summary && <span className="block max-w-80 truncate text-xs text-ink-2">{r.summary}</span>}
              </span>
            ),
          },
          { header: "Category", cell: (r) => <span className="text-ink-2">{r.category}</span> },
          { header: "Version", cell: (r) => `v${r.version}` },
          { header: "Takes effect", cell: (r) => shortDate(r.effectiveDate) },
          { header: "Status", cell: (r) => <Pill tone={r.status === "published" ? "good" : r.status === "draft" ? "warn" : "neutral"}>{r.status === "published" ? "Published" : r.status === "draft" ? "Draft" : "Archived"}</Pill> },
          {
            header: "Read by",
            cell: (r) =>
              r.status === "published" && r.requireAck ? (
                <button type="button" onClick={() => setViewing(r)} className="text-sm hover:underline">
                  {r.acknowledged} of {r.total}
                </button>
              ) : (
                <span className="text-ink-3">—</span>
              ),
          },
          {
            header: "",
            align: "right",
            cell: (r) => (
              <span className="flex justify-end gap-2">
                {r.fileId && (
                  <Button size="sm" variant="ghost" onClick={() => openPolicyFile(r.fileId!)}>
                    Open document
                  </Button>
                )}
                {canEdit && r.status !== "archived" && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                    Edit
                  </Button>
                )}
                {canEdit && r.status === "draft" && (
                  <>
                    <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => window.confirm(`Delete the draft "${r.title}"?`) && remove.mutate(r)}>
                      Delete
                    </Button>
                    <Button size="sm" disabled={status.isPending} onClick={() => status.mutate({ r, s: "published" })}>
                      Publish
                    </Button>
                  </>
                )}
                {canEdit && r.status === "published" && (
                  <Button size="sm" variant="ghost" disabled={status.isPending} onClick={() => window.confirm(`Archive "${r.title}"? Employees will no longer see it.`) && status.mutate({ r, s: "archived" })}>
                    Archive
                  </Button>
                )}
                {canEdit && r.status === "archived" && (
                  <Button size="sm" variant="ghost" disabled={status.isPending} onClick={() => status.mutate({ r, s: "published" })}>
                    Publish again
                  </Button>
                )}
              </span>
            ),
          },
        ]}
      />
      {editing && <PolicyDialog row={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {viewing && <AcksDrawer row={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
