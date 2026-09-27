import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createOffboardingCase, updateOffboardingCase } from "@/lib/api";
import { employeeDirectory } from "@/lib/mockData";
import type { OffboardingCase, OffboardingStage } from "@/lib/types";

const stages: OffboardingStage[] = ["Resignation filed", "Clearance in progress", "Final pay released"];

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

function OffboardingForm({
  existing,
  onClose,
  onSubmitted,
}: {
  existing: OffboardingCase | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState(
    employeeDirectory.find((e) => e.name === existing?.employeeName)?.id ?? employeeDirectory[0]?.id ?? "",
  );
  const [lastDay, setLastDay] = useState(existing?.lastDay ?? "");
  const [stage, setStage] = useState<OffboardingStage>(existing?.stage ?? "Resignation filed");

  const mutation = useMutation({
    mutationFn: (input: { employeeName: string; employeeInitials: string; department: string; lastDay: string; stage: OffboardingStage }) =>
      existing ? updateOffboardingCase(existing.id, input) : createOffboardingCase(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "offboarding"] });
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const employee = employeeDirectory.find((emp) => emp.id === employeeId);
    if (!employee || !lastDay.trim()) return;
    mutation.mutate({
      employeeName: employee.name,
      employeeInitials: employee.initials,
      department: employee.department,
      lastDay: lastDay.trim(),
      stage,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="off-employee" className={labelClass}>
          Employee
        </label>
        <select
          id="off-employee"
          className={inputClass}
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          disabled={existing !== null}
        >
          {employeeDirectory.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="off-last-day" className={labelClass}>
          Last day
        </label>
        <input
          id="off-last-day"
          required
          className={inputClass}
          placeholder="e.g. Oct 31, 2026"
          value={lastDay}
          onChange={(e) => setLastDay(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="off-stage" className={labelClass}>
          Stage
        </label>
        <select id="off-stage" className={inputClass} value={stage} onChange={(e) => setStage(e.target.value as OffboardingStage)}>
          {stages.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : existing ? "Save changes" : "Initiate offboarding"}
        </Button>
      </div>
    </form>
  );
}

export function OffboardingCaseDialog({
  open,
  existing,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  existing: OffboardingCase | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={existing ? "Edit offboarding case" : "Initiate offboarding"}>
      <OffboardingForm key={existing?.id ?? "new"} existing={existing} onClose={onClose} onSubmitted={onSubmitted} />
    </Dialog>
  );
}
