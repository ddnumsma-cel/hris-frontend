import { Dialog } from "@/components/ui/Dialog";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import type { Employee } from "@/lib/types";

const statusVariant: Record<Employee["status"], ChipVariant> = {
  Active: "good",
  "On leave": "neutral",
};

export function EmployeeProfileDialog({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <Dialog open={employee !== null} onClose={onClose} title="Employee 201 file">
      {employee && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-sm font-bold text-ink-2">
              {employee.initials}
            </span>
            <div>
              <div className="font-display text-base font-bold">{employee.name}</div>
              <div className="text-xs text-ink-2">{employee.position}</div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold text-ink-2">Employee ID</dt>
              <dd className="font-num mt-0.5">{employee.id}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-2">Status</dt>
              <dd className="mt-0.5">
                <Chip variant={statusVariant[employee.status]}>{employee.status}</Chip>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-2">Department</dt>
              <dd className="mt-0.5">{employee.department}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-2">Office</dt>
              <dd className="mt-0.5">{employee.office}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-2">Cluster</dt>
              <dd className="mt-0.5">{employee.cluster}</dd>
            </div>
          </dl>
        </div>
      )}
    </Dialog>
  );
}
