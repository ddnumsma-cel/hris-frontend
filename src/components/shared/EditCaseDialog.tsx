import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { updateCaseDetails } from "@/lib/api";
import type { CaseType, EmployeeCase } from "@/lib/types";

const caseTypes: CaseType[] = ["Attendance", "Conduct", "Performance", "Grievance"];

const inputClass =
  "field w-full px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs font-medium text-ink";

function EditCaseForm({
  employeeCase,
  onClose,
  onSubmitted,
}: {
  employeeCase: EmployeeCase;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<CaseType>(employeeCase.type);
  const [summary, setSummary] = useState(employeeCase.summary);

  const mutation = useMutation({
    mutationFn: () => updateCaseDetails(employeeCase.id, { type, summary: summary.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="edit-case-type" className={labelClass}>
          Case type
        </label>
        <select id="edit-case-type" className={inputClass} value={type} onChange={(e) => setType(e.target.value as CaseType)}>
          {caseTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="edit-case-summary" className={labelClass}>
          Summary
        </label>
        <textarea
          id="edit-case-summary"
          rows={3}
          required
          className={inputClass}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export function EditCaseDialog({
  employeeCase,
  onClose,
  onSubmitted,
}: {
  employeeCase: EmployeeCase | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  return (
    <Dialog open={employeeCase !== null} onClose={onClose} title="Edit case">
      {employeeCase && (
        <EditCaseForm key={employeeCase.id} employeeCase={employeeCase} onClose={onClose} onSubmitted={onSubmitted} />
      )}
    </Dialog>
  );
}
