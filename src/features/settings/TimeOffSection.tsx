import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SaveBar } from "@/components/ui/SaveBar";
import { SettingsCard, SettingsHeader, SettingsRow } from "@/components/ui/SettingsCard";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/ToastContext";
import { useActor } from "@/features/admin/corehr/format";
import { LeaveTypesPage } from "@/features/admin/leave/LeaveTypesPage";
import type { Holiday } from "@/lib/holidays";
import type { LeavePolicy } from "@/lib/leave/store";
import { fmtDay } from "@/lib/preferences";
import { addCustomHoliday, getCustomHolidays, getLeaveApprovalSummary, getLeavePolicy, removeCustomHoliday, saveLeavePolicy } from "@/lib/settings/workspace";
import { SectionSkeleton } from "./AccountSection";
import { Embedded } from "./SettingsLayout";
import { useDraft, useUnsavedGuard } from "./useSettings";

const inputClass = "field w-full px-3 py-2 text-sm";
const ACCRUAL: { value: LeavePolicy["accrual"]; label: string }[] = [
  { value: "yearly", label: "Yearly (all at the start of the year)" },
  { value: "monthly", label: "Monthly" },
  { value: "per-payroll", label: "Every payroll cutoff" },
];

export function TimeOffSection() {
  const actor = useActor();
  const toast = useToast();
  const queryClient = useQueryClient();
  const policy = useQuery({ queryKey: ["settings", "leave-policy"], queryFn: getLeavePolicy });
  const approval = useQuery({ queryKey: ["settings", "leave-approval"], queryFn: getLeaveApprovalSummary });
  const holidays = useQuery({ queryKey: ["settings", "holidays"], queryFn: getCustomHolidays });
  const { draft, setDraft, dirty, discard } = useDraft<LeavePolicy>(policy.data);
  const guard = useUnsavedGuard(dirty);
  const [newHoliday, setNewHoliday] = useState<{ date: string; name: string; type: Holiday["type"] }>({ date: "", name: "", type: "special" });
  const [removing, setRemoving] = useState<Holiday | null>(null);

  const refreshLeave = () => queryClient.invalidateQueries({ queryKey: ["leave"] });
  const savePolicy = useMutation({
    mutationFn: (p: LeavePolicy) => saveLeavePolicy(p, actor),
    onSuccess: (next) => {
      queryClient.setQueryData(["settings", "leave-policy"], next);
      refreshLeave();
      toast.show("Leave policy saved.");
    },
    onError: (e: Error) => toast.show(e.message, "critical"),
  });
  const add = useMutation({
    mutationFn: () => addCustomHoliday(newHoliday, actor),
    onSuccess: (next) => {
      queryClient.setQueryData(["settings", "holidays"], next);
      refreshLeave();
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      setNewHoliday({ date: "", name: "", type: "special" });
      toast.show("Holiday added. Leave and attendance now count it.");
    },
    onError: (e: Error) => toast.show(e.message, "critical"),
  });
  const remove = useMutation({
    mutationFn: (date: string) => removeCustomHoliday(date, actor),
    onSuccess: (next) => {
      queryClient.setQueryData(["settings", "holidays"], next);
      refreshLeave();
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      setRemoving(null);
      toast.show("Holiday removed.");
    },
  });

  if (!draft) return <SectionSkeleton title="Time off & leave" />;
  const carryError = !(Number.isInteger(draft.defaultCarryOver) && draft.defaultCarryOver >= 0 && draft.defaultCarryOver <= 365) ? "Use a whole number from 0 to 365." : undefined;
  const set = (patch: Partial<LeavePolicy>) => setDraft({ ...draft, ...patch });

  return (
    <>
      <SettingsHeader title="Time off & leave" description="Leave rules, company holidays, and the kinds of leave people can file." />

      <SettingsCard title="Policy">
        <SettingsRow label="Approval flow" help={approval.data ?? "…"}>
          <Link to="/admin/maintenance/rules" className="text-[13px] font-medium text-brand-ink hover:underline">
            Edit in Approval workflows
          </Link>
        </SettingsRow>
        <SettingsRow label="Allow half days" htmlFor="lv-half" help="Let people file a morning or afternoon only.">
          <Switch id="lv-half" checked={draft.allowHalfDays} onChange={(on) => set({ allowHalfDays: on })} />
        </SettingsRow>
        <SettingsRow label="Allow negative balance" htmlFor="lv-neg" help="Let people file leave beyond what they have left.">
          <Switch id="lv-neg" checked={draft.allowNegative} onChange={(on) => set({ allowNegative: on })} />
        </SettingsRow>
        <SettingsRow label="Carry-over limit (days)" htmlFor="lv-carry" help="Pre-filled for new leave types; each type can set its own." error={carryError}>
          <input id="lv-carry" type="number" min={0} max={365} className={inputClass} value={draft.defaultCarryOver} aria-invalid={!!carryError} onChange={(e) => set({ defaultCarryOver: e.target.valueAsNumber })} />
        </SettingsRow>
        <SettingsRow label="Accrual frequency" htmlFor="lv-accrual" help="Leave credits are granted yearly today; other schedules are coming.">
          {/* TODO: monthly and per-payroll accrual aren't calculated yet; credits are yearly. */}
          <select id="lv-accrual" className={inputClass} value={draft.accrual} onChange={(e) => set({ accrual: e.target.value as LeavePolicy["accrual"] })}>
            {ACCRUAL.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Company holidays" description="Added on top of the national holidays. Leave and attendance treat them like any holiday.">
        {holidays.data?.length === 0 && <p className="px-5 py-4 text-[13px] text-ink-2">No company holidays yet.</p>}
        {holidays.data?.map((h) => (
          <SettingsRow key={h.date} label={h.name} help={`${fmtDay(h.date)} · ${h.type === "regular" ? "Regular holiday" : "Special non-working day"}`}>
            <Button variant="ghost" size="sm" onClick={() => setRemoving(h)}>
              Remove
            </Button>
          </SettingsRow>
        ))}
        <form
          className="grid gap-3 px-5 py-4 sm:grid-cols-[9rem_1fr_11rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div>
            <label htmlFor="hol-date" className="mb-1 block text-xs font-medium text-ink">
              Date
            </label>
            <input id="hol-date" type="date" required className={inputClass} value={newHoliday.date} onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })} />
          </div>
          <div>
            <label htmlFor="hol-name" className="mb-1 block text-xs font-medium text-ink">
              Name
            </label>
            <input id="hol-name" required className={inputClass} placeholder="e.g. Company anniversary" value={newHoliday.name} onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="hol-type" className="mb-1 block text-xs font-medium text-ink">
              Type
            </label>
            <select id="hol-type" className={inputClass} value={newHoliday.type} onChange={(e) => setNewHoliday({ ...newHoliday, type: e.target.value as Holiday["type"] })}>
              <option value="special">Special non-working day</option>
              <option value="regular">Regular holiday</option>
            </select>
          </div>
          <Button type="submit" disabled={add.isPending || !newHoliday.date || !newHoliday.name.trim()}>
            Add holiday
          </Button>
        </form>
      </SettingsCard>

      <SaveBar visible={dirty} saving={savePolicy.isPending} invalid={!!carryError} onDiscard={discard} onSave={() => savePolicy.mutate(draft)} />

      <Embedded>
        <LeaveTypesPage />
      </Embedded>

      <ConfirmDialog
        open={!!removing}
        title="Remove this holiday?"
        message={removing ? `${removing.name} on ${fmtDay(removing.date)} will count as a normal day for leave and attendance.` : ""}
        confirmLabel="Remove holiday"
        isPending={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.date)}
        onClose={() => setRemoving(null)}
      />
      {guard}
    </>
  );
}
