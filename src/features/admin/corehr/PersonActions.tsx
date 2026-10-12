import { useState } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { EditIcon, EyeIcon, FileIcon, TrashIcon } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/ToastContext";
import { deleteEmployee, getEmployee, type EmployeeSummary } from "@/lib/corehr/api";
import { useCan } from "@/lib/useCan";
import { keys, useActor } from "./format";
import { EditSectionDialog } from "./EditSectionDialog";

const actionClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border border-border bg-surface-2 text-ink-2 transition-colors duration-150 hover:border-brand hover:bg-brand-tint hover:text-brand";

/** Loads the full record, then opens the same edit dialog the record page uses. */
export function EditPersonDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const recordQuery = useQuery({ queryKey: keys.employee(employeeId), queryFn: () => getEmployee(employeeId) });
  const record = recordQuery.data;
  return record ? <EditSectionDialog employee={record.employee} section="personal" onClose={onClose} /> : null;
}

/** Asks before deleting someone's 201 file, then removes it. */
export function DeletePersonDialog({ e, onClose }: { e: EmployeeSummary; onClose: () => void }) {
  const actor = useActor();
  const toast = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteEmployee(e.id, actor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["corehr"] });
      queryClient.removeQueries({ queryKey: keys.employee(e.id) });
      toast.show(`Deleted ${e.name}.`);
      onClose();
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : "Couldn't delete this employee.", "critical"),
  });
  return (
    <ConfirmDialog
      open
      title={`Delete ${e.name}?`}
      message="Their 201 file, documents and job history are removed for good and their login is turned off. Anyone who reports to them moves up to their manager. If they worked here and left, record a separation instead."
      confirmLabel="Delete"
      pendingLabel="Deleting…"
      isPending={remove.isPending}
      onConfirm={() => remove.mutate()}
      onClose={onClose}
    />
  );
}

/** Icon buttons in a table row: view the record, edit personal details, open the 201 documents. */
export function PersonActions({ e, className }: { e: EmployeeSummary; className?: string }) {
  const canEdit = useCan("edit", "people");
  const canDelete = useCan("delete", "people");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <span className={clsx("flex items-center gap-2", className)} onClick={(ev) => ev.stopPropagation()}>
      <Link to={`/admin/maintenance/people/${e.id}`} aria-label={`View ${e.name}`} title="View" className={actionClass}>
        <EyeIcon aria-hidden="true" className="h-4 w-4" />
      </Link>
      {canEdit && (
        <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${e.name}`} title="Edit" className={actionClass}>
          <EditIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
      <Link to={`/admin/maintenance/people/${e.id}#documents`} aria-label={`201 documents for ${e.name}`} title="201 documents" className={actionClass}>
        <FileIcon aria-hidden="true" className="h-4 w-4" />
      </Link>
      {canDelete && (
        <button type="button" onClick={() => setDeleting(true)} aria-label={`Delete ${e.name}`} title="Delete" className="delete-action inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border transition-colors duration-150">
          <TrashIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
      {editing && <EditPersonDialog employeeId={e.id} onClose={() => setEditing(false)} />}
      {deleting && <DeletePersonDialog e={e} onClose={() => setDeleting(false)} />}
    </span>
  );
}
