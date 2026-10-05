import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ContentHead } from "@/components/layout/RolePage";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { listTypes, saveType, setTypeActive } from "@/lib/leave/api";
import type { Earning, Eligibility, LeaveType } from "@/lib/leave/types";
import { inputClass } from "../corehr/format";
import { ErrorNote, Field, LoadError, Pill } from "../corehr/ui";
import { SimpleTable, type Col } from "../timekeeping/common";
import { earningText, ELIGIBILITY, leaveKeys, proofText, useLeaveRefresh } from "./format";

type Draft = Omit<LeaveType, "id" | "active" | "earning"> & { id?: string; earningKind: Earning["kind"]; perMonth: number };

const BLANK: Draft = { name: "", code: "", daysPerYear: 5, earningKind: "yearly", perMonth: 1.25, paid: true, carryOverMax: 0, countBy: "workdays", eligibility: "everyone", attachmentOver: null, confidential: false, basis: "Company policy" };

function toDraft(t: LeaveType): Draft {
  const { earning, active: _active, ...rest } = t;
  return { ...rest, earningKind: earning.kind, perMonth: earning.kind === "monthly" ? earning.perMonth : 1.25 };
}

function TypeDialog({ initial, onClose }: { initial: Draft; onClose: () => void }) {
  const toast = useToast();
  const refresh = useLeaveRefresh();
  const [d, setD] = useState(initial);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const save = useMutation({
    mutationFn: () => {
      const { earningKind, perMonth, ...rest } = d;
      const earning: Earning = earningKind === "monthly" ? { kind: "monthly", perMonth } : { kind: earningKind };
      return saveType({ ...rest, earning, daysPerYear: earningKind === "unlimited" ? 0 : rest.daysPerYear });
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
        <Field id="lt-earn" label="How it's earned">
          <select id="lt-earn" className={inputClass} value={d.earningKind} onChange={(e) => set({ earningKind: e.target.value as Earning["kind"] })}>
            <option value="monthly">A little every month</option>
            <option value="yearly">All at once every January</option>
            <option value="per-event">Each time it applies (e.g. a birth)</option>
            <option value="unlimited">No limit (unpaid)</option>
          </select>
        </Field>
        {d.earningKind !== "unlimited" ? (
          <Field id="lt-days" label="Days a year">
            <input id="lt-days" type="number" min={0.5} step={0.5} className={inputClass} value={d.daysPerYear} onChange={(e) => set({ daysPerYear: e.target.valueAsNumber })} />
          </Field>
        ) : (
          <div />
        )}
        {d.earningKind === "monthly" && (
          <Field id="lt-month" label="Days earned each month" hint={`Reaches ${d.daysPerYear} after ${Math.ceil(d.daysPerYear / (d.perMonth || 1))} months.`}>
            <input id="lt-month" type="number" min={0.25} step={0.25} className={inputClass} value={d.perMonth} onChange={(e) => set({ perMonth: e.target.valueAsNumber })} />
          </Field>
        )}
        {d.earningKind === "monthly" || d.earningKind === "yearly" ? (
          <Field id="lt-carry" label="Unused days kept next year" hint="0 means they expire.">
            <input id="lt-carry" type="number" min={0} className={inputClass} value={d.carryOverMax} onChange={(e) => set({ carryOverMax: e.target.valueAsNumber || 0 })} />
          </Field>
        ) : null}
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
    { header: "How it's earned", cell: (t) => `${earningText(t)}${t.paid ? "" : ", unpaid"}` },
    { header: "Kept next year", cell: (t) => (t.carryOverMax ? `Up to ${t.carryOverMax}` : "—") },
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
      <ContentHead title="Leave types" subtitle="The kinds of leave employees can file and how the days are earned. Maternity, paternity, solo parent, VAWC and special leave for women follow the law." actions={<Button onClick={() => setEditing(BLANK)}>Add leave type</Button>} />
      <SimpleTable rows={typesQuery.data ?? []} rowKey={(t) => t.id} cols={cols} loading={typesQuery.isLoading} empty="No leave types yet." />
      {editing && <TypeDialog initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
