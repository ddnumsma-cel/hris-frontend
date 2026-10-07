import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { listTypes, saveType, setTypeActive } from "@/lib/leave/api";
import { LEAVE_CREDITS_PER_YEAR } from "@/lib/leave/store";
import type { Eligibility, LeaveType } from "@/lib/leave/types";
import { inputClass } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { SimpleTable, type Col } from "../timekeeping/common";
import { ELIGIBILITY, leaveKeys, proofText, useLeaveRefresh } from "./format";
import { useCreateParam } from "@/lib/useCreateParam";

/** Paid types use one of the yearly leaves; unpaid ones (Leave without pay) have no limit. */
type Draft = Omit<LeaveType, "id" | "active" | "earning"> & { id?: string; usesCredit: boolean };

const BLANK: Draft = { name: "", code: "", daysPerYear: LEAVE_CREDITS_PER_YEAR, usesCredit: true, paid: true, carryOverMax: 0, countBy: "workdays", eligibility: "everyone", attachmentOver: null, confidential: false, basis: "Company policy" };

function toDraft(t: LeaveType): Draft {
  const { earning, active: _active, ...rest } = t;
  return { ...rest, usesCredit: earning.kind !== "unlimited" };
}

function TypeDialog({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const toast = useToast();
  const refresh = useLeaveRefresh();
  const [d, setD] = useState(initial);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const save = useMutation({
    mutationFn: () => {
      const { usesCredit, ...rest } = d;
      return saveType({ ...rest, earning: usesCredit ? { kind: "yearly" } : { kind: "unlimited" }, daysPerYear: usesCredit ? LEAVE_CREDITS_PER_YEAR : 0, carryOverMax: 0 });
    },
    onSuccess: () => {
      refresh();
      toast.show(d.id ? "Leave type saved." : "Leave type added.");
      onClose();
    },
  });
  const proof = d.attachmentOver === null ? "never" : d.attachmentOver === 0 ? "always" : "over";

  return (
    <Dialog
      open
      onClose={onClose}
      title={d.id ? `Edit ${initial.name}` : "Add a leave type"}
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
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field id="lt-name" label="Name" required>
          <input id="lt-name" className={inputClass} value={d.name} placeholder="e.g. Birthday leave" onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field id="lt-code" label="Short code" required>
          <input id="lt-code" className={inputClass} value={d.code} maxLength={5} placeholder="e.g. BDL" onChange={(e) => set({ code: e.target.value })} />
        </Field>
        <Field id="lt-earn" label="Uses a leave credit" className="col-span-2" hint={d.usesCredit ? `Each one filed uses 1 of the employee's ${LEAVE_CREDITS_PER_YEAR} leaves a year.` : "Doesn't touch the yearly leaves. Use this for unpaid leave."}>
          <select id="lt-earn" className={inputClass} value={d.usesCredit ? "yes" : "no"} onChange={(e) => set({ usesCredit: e.target.value === "yes", paid: e.target.value === "yes" ? d.paid : false })}>
            <option value="yes">Yes, 1 of the {LEAVE_CREDITS_PER_YEAR} a year</option>
            <option value="no">No limit (unpaid)</option>
          </select>
        </Field>
        <Field id="lt-who" label="Who can use it">
          <select id="lt-who" className={inputClass} value={d.eligibility} onChange={(e) => set({ eligibility: e.target.value as Eligibility })}>
            {Object.entries(ELIGIBILITY).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field id="lt-count" label="Count">
          <select id="lt-count" className={inputClass} value={d.countBy} onChange={(e) => set({ countBy: e.target.value as LeaveType["countBy"] })}>
            <option value="workdays">Working days only</option>
            <option value="calendar">Every day, weekends too</option>
          </select>
        </Field>
        <Field id="lt-proof" label="Supporting document">
          <select id="lt-proof" className={inputClass} value={proof} onChange={(e) => set({ attachmentOver: e.target.value === "never" ? null : e.target.value === "always" ? 0 : 2 })}>
            <option value="never">Not needed</option>
            <option value="always">Always needed</option>
            <option value="over">Needed when longer than…</option>
          </select>
        </Field>
        {proof === "over" ? (
          <Field id="lt-over" label="Longer than (days)">
            <input id="lt-over" type="number" min={1} className={inputClass} value={d.attachmentOver ?? 2} onChange={(e) => set({ attachmentOver: Math.max(1, e.target.valueAsNumber || 1) })} />
          </Field>
        ) : (
          <div />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.paid} onChange={(e) => set({ paid: e.target.checked })} /> Paid leave
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.confidential} onChange={(e) => set({ confidential: e.target.checked })} /> Keep the reason private
        </label>
        <div className="col-span-2">
          <ErrorNote error={save.error} />
        </div>
      </div>
    </Dialog>
  );
}

export function LeaveTypesPage() {
  const toast = useToast();
  const refresh = useLeaveRefresh();
  const typesQuery = useQuery({ queryKey: leaveKeys.types, queryFn: listTypes });
  const [editing, setEditing] = useState<Draft | null>(null);
  useCreateParam("leave-type", () => setEditing(BLANK));
  const toggle = useMutation({
    mutationFn: (t: LeaveType) => setTypeActive(t.id, !t.active),
    onSuccess: (_, t) => {
      refresh();
      toast.show(t.active ? `${t.name} turned off. It can't be filed anymore.` : `${t.name} turned on.`);
    },
  });

  if (typesQuery.isError) return <LoadError onRetry={() => typesQuery.refetch()} />;

  const cols: Col<LeaveType>[] = [
    {
      header: "Leave type",
      cell: (t) => (
        <span className="block max-w-60">
          <span className="block font-medium">
            {t.name} ({t.code})
          </span>
          <span className="block truncate text-xs text-ink-3" title={t.basis}>
            {t.basis}
          </span>
        </span>
      ),
    },
    { header: "Uses", cell: (t) => (t.earning.kind === "unlimited" ? "No limit, unpaid" : `1 of the ${LEAVE_CREDITS_PER_YEAR} yearly leaves`) },
    { header: "Who", cell: (t) => ELIGIBILITY[t.eligibility] },
    { header: "Document", cell: (t) => proofText(t.attachmentOver) },
    { header: "Status", cell: (t) => <Pill tone={t.active ? "good" : "neutral"}>{t.active ? "In use" : "Off"}</Pill> },
    {
      header: "",
      align: "right",
      cell: (t) => (
        <span className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate(t)}>
            {t.active ? "Turn off" : "Turn on"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(toDraft(t))}>
            Edit
          </Button>
        </span>
      ),
    },
  ];

  return (
    <>
      <ContentHead title="Leave types" subtitle={`The kinds of leave employees can file. Every paid type shares the same ${LEAVE_CREDITS_PER_YEAR} leaves a year; filing any of them uses 1.`} actions={<Button onClick={() => setEditing(BLANK)}>Add leave type</Button>} />
      <SimpleTable rows={typesQuery.data ?? []} rowKey={(t) => t.id} cols={cols} loading={typesQuery.isLoading} empty="No leave types yet." />
      {editing && <TypeDialog initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
