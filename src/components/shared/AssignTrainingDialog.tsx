import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createTrainingRecord } from "@/lib/api";

const courses = [
  "Data Privacy Act Refresher",
  "Anti-Money Laundering Basics",
  "Workplace Safety Orientation",
  "Client Confidentiality Standards",
];

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

export function AssignTrainingDialog({
  open,
  employees,
  invalidateKey,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  employees: { id: string; name: string; initials: string }[];
  invalidateKey: unknown[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [course, setCourse] = useState(courses[0]);
  const [dueDate, setDueDate] = useState("");

  const mutation = useMutation({
    mutationFn: createTrainingRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      setDueDate("");
      onClose();
      onSubmitted();
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee || !dueDate.trim()) return;
    mutation.mutate({
      employeeName: employee.name,
      employeeInitials: employee.initials,
      course,
      dueDate: dueDate.trim(),
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Assign training">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label htmlFor="train-employee" className={labelClass}>
            Employee
          </label>
          <select
            id="train-employee"
            className={inputClass}
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="train-course" className={labelClass}>
            Course
          </label>
          <select id="train-course" className={inputClass} value={course} onChange={(e) => setCourse(e.target.value)}>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="train-due" className={labelClass}>
            Due date
          </label>
          <input
            id="train-due"
            required
            className={inputClass}
            placeholder="e.g. Nov 15, 2026"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Assigning…" : "Assign training"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
