import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createEmployeeCase } from "@/lib/api";
import { currentManager, teamRoster } from "@/lib/mockData";
import type { CaseType } from "@/lib/types";

const caseTypes: CaseType[] = ["Attendance", "Conduct", "Performance", "Grievance"];

const inputClass =
  "field w-full px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium text-ink";

export function FileCaseDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState(teamRoster[0]?.id ?? "");
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
    const member = teamRoster.find((m) => m.id === employeeId);
    if (!member || !summary.trim()) return;
    mutation.mutate({
      employeeName: member.name,
      employeeInitials: member.initials,
      type,
      summary: summary.trim(),
      filedBy: currentManager.name,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="File a case">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="case-employee" className={labelClass}>
            Team member
          </label>
          <select id="case-employee" className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            {teamRoster.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="case-type" className={labelClass}>
            Case type
          </label>
          <select id="case-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as CaseType)}>
            {caseTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="case-summary" className={labelClass}>
            Summary
          </label>
          <textarea
            id="case-summary"
            rows={3}
            required
            className={inputClass}
            placeholder="Describe the incident and any context HR should know"
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
