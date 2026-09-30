import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { countLeaveDays, fetchEmployeeDirectory, fetchLeaveBalanceFor, fileLeaveForEmployee } from "@/lib/api";
import type { LeaveType } from "@/lib/types";

const leaveTypes: LeaveType[] = ["Vacation", "Sick", "Emergency", "Bereavement"];

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

function formatCredits(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function FileLeaveForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: (name: string) => void }) {
  const queryClient = useQueryClient();
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const employees = [...(directoryQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<LeaveType>("Vacation");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const employee = employees.find((e) => e.id === employeeId) ?? employees[0];
  const balanceQuery = useQuery({
    queryKey: ["admin", "leave-balance", employee?.name, type],
    queryFn: () => fetchLeaveBalanceFor(employee!.name, type),
    enabled: Boolean(employee),
  });
  const balance = balanceQuery.data;

  const datesChosen = Boolean(startDate && endDate);
  const endBeforeStart = datesChosen && endDate < startDate;
  const requestedDays = datesChosen && !endBeforeStart ? countLeaveDays(startDate, endDate) : 0;
  const overBalance = balance !== undefined && requestedDays > balance.available;
  const error = endBeforeStart
    ? "End date can't be before the start date."
    : datesChosen && requestedDays === 0
      ? "Those dates fall on a weekend."
      : overBalance
        ? `That's ${requestedDays} days — only ${formatCredits(balance.available)} available.`
        : null;

  const mutation = useMutation({
    mutationFn: fileLeaveForEmployee,
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leave-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "leave-balance"] });
      queryClient.invalidateQueries({ queryKey: ["approvals-queue"] });
      onClose();
      onSubmitted(request.employeeName);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employee || !datesChosen || error) return;
    mutation.mutate({ employeeId: employee.id, type, startDate, endDate, reason });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="file-leave-employee" className={labelClass}>
          Employee
        </label>
        <select
          id="file-leave-employee"
          className={inputClass}
          value={employee?.id ?? ""}
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
        <label htmlFor="file-leave-type" className={labelClass}>
          Leave type
        </label>
        <select
          id="file-leave-type"
          className={inputClass}
          value={type}
          onChange={(e) => setType(e.target.value as LeaveType)}
        >
          {leaveTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {balance && (
        <p
          className={clsx(
            "rounded-lg px-3 py-2 text-[0.82rem]",
            balance.available > 0 ? "bg-good-tint text-good" : "bg-critical-tint text-critical",
          )}
        >
          <span className="font-semibold">{formatCredits(balance.available)} days available</span> ·{" "}
          {balance.credits} credits − {formatCredits(balance.used)} used − {formatCredits(balance.pending)} pending
        </p>
      )}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="file-leave-start" className={labelClass}>
            Start date
          </label>
          <input
            id="file-leave-start"
            type="date"
            required
            className={inputClass}
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
            }}
          />
        </div>
        <div>
          <label htmlFor="file-leave-end" className={labelClass}>
            End date
          </label>
          <input
            id="file-leave-end"
            type="date"
            required
            min={startDate || undefined}
            className={inputClass}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="file-leave-reason" className={labelClass}>
          Reason <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <textarea
          id="file-leave-reason"
          rows={3}
          className={inputClass}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs font-semibold text-critical">
          {error}
        </p>
      )}

      <div className="-mx-4.5 mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border px-4.5 pt-3.5">
        <span className="text-xs text-ink-3">Routed to the Partner, then HR</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending || Boolean(error)}>
            {mutation.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function FileLeaveDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: (name: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="File a leave request" dismissOnBackdrop={false}>
      <FileLeaveForm onClose={onClose} onSubmitted={onSubmitted} />
    </Dialog>
  );
}
