import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createEmployeeCase } from "@/lib/api";
import { currentAdmin, employeeDirectory } from "@/lib/mockData";
import type { CaseType } from "@/lib/types";

const caseTypes: CaseType[] = ["Attendance", "Conduct", "Performance", "Grievance"];

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

export function AdminFileCaseDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState(employeeDirectory[0]?.id ?? "");
  const [type, setType] = useState<CaseType>("Attendance");
  const [summary, setSummary] = useState("");

  const mutation = useMutation({
    mutationFn: createEmployeeCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      setSummary("");
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const employee = employeeDirectory.find((emp) => emp.id === employeeId);
    if (!employee || !summary.trim()) return;
    mutation.mutate({
      employeeName: employee.name,
      employeeInitials: employee.initials,
      type,
      summary: summary.trim(),
      filedBy: currentAdmin.name,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="File a case">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="admin-case-employee" className={labelClass}>
            Employee
          </label>
          <select
            id="admin-case-employee"
            className={inputClass}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {employeeDirectory.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="admin-case-type" className={labelClass}>
            Case type
          </label>
          <select id="admin-case-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as CaseType)}>
            {caseTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="admin-case-summary" className={labelClass}>
            Summary
          </label>
          <textarea
            id="admin-case-summary"
            rows={3}
            required
            className={inputClass}
            placeholder="Describe the incident and any relevant context"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Filing…" : "File case"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
