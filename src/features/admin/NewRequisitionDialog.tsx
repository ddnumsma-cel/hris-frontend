import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createJobRequisition, fetchEmployeeDirectory } from "@/lib/api";
import type { Employee, EmploymentType } from "@/lib/types";

const offices: Employee["office"][] = ["Cebu HQ", "Manila", "Davao"];
const employmentTypes: EmploymentType[] = ["Probationary → Regular", "Project-based", "Fixed-term", "Part-time"];
const APPROVAL_ROUTE = "Partner → HR → Project Sponsor";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand";
const labelClass = "mb-1 block text-xs font-semibold text-ink-2";

function RequisitionForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: (title: string) => void }) {
  const queryClient = useQueryClient();
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  // "Audit & Assurance · VCM" — every department and cluster pairing in the directory.
  const departmentClusters = [
    ...new Map(
      (directoryQuery.data ?? []).map((e) => [
        e.department === e.cluster ? e.department : `${e.department} · ${e.cluster}`,
        { department: e.department, cluster: e.cluster },
      ]),
    ),
  ].sort(([a], [b]) => a.localeCompare(b));

  const [title, setTitle] = useState("");
  const [departmentCluster, setDepartmentCluster] = useState("");
  const [office, setOffice] = useState<Employee["office"]>("Cebu HQ");
  const [openings, setOpenings] = useState("1");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("Probationary → Regular");
  const [targetStart, setTargetStart] = useState("");
  const [salaryRange, setSalaryRange] = useState("");
  const [justification, setJustification] = useState("");

  const selectedPair = departmentClusters.find(([key]) => key === departmentCluster)?.[1] ?? departmentClusters[0]?.[1];

  const mutation = useMutation({
    mutationFn: createJobRequisition,
    onSuccess: (requisition) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "job-requisitions"] });
      onClose();
      onSubmitted(requisition.title);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const count = Number(openings);
    if (!title.trim() || !selectedPair || !Number.isInteger(count) || count < 1 || !targetStart || !justification.trim()) {
      return;
    }
    mutation.mutate({
      title: title.trim(),
      department: selectedPair.department,
      cluster: selectedPair.cluster,
      office,
      openings: count,
      employmentType,
      targetStart,
      salaryRange: salaryRange.trim() || undefined,
      justification: justification.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div>
        <label htmlFor="req-title" className={labelClass}>
          Role title
        </label>
        <input
          id="req-title"
          required
          className={inputClass}
          placeholder="Audit Associate"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="req-department" className={labelClass}>
            Department · Cluster
          </label>
          <select
            id="req-department"
            className={inputClass}
            value={departmentCluster || departmentClusters[0]?.[0] || ""}
            onChange={(e) => setDepartmentCluster(e.target.value)}
          >
            {departmentClusters.map(([key]) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="req-office" className={labelClass}>
            Office
          </label>
          <select
            id="req-office"
            className={inputClass}
            value={office}
            onChange={(e) => setOffice(e.target.value as Employee["office"])}
          >
            {offices.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="req-openings" className={labelClass}>
            Openings
          </label>
          <input
            id="req-openings"
            type="number"
            min={1}
            required
            className={inputClass}
            value={openings}
            onChange={(e) => setOpenings(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="req-employment-type" className={labelClass}>
            Employment type
          </label>
          <select
            id="req-employment-type"
            className={inputClass}
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
          >
            {employmentTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="req-target-start" className={labelClass}>
            Target start
          </label>
          <input
            id="req-target-start"
            type="date"
            required
            className={inputClass}
            value={targetStart}
            onChange={(e) => setTargetStart(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="req-salary" className={labelClass}>
            Salary range <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <input
            id="req-salary"
            className={inputClass}
            placeholder="₱28,000–₱34,000"
            value={salaryRange}
            onChange={(e) => setSalaryRange(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor="req-justification" className={labelClass}>
          Justification
        </label>
        <textarea
          id="req-justification"
          required
          rows={3}
          className={inputClass}
          placeholder="Why this role is needed now"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />
      </div>

      <div>
        <span className={labelClass}>Approval route</span>
        <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">{APPROVAL_ROUTE}</div>
      </div>

      <div className="-mx-4.5 mt-1 flex justify-end gap-2 border-t border-border px-4.5 pt-3.5">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Submitting…" : "Submit for approval"}
        </Button>
      </div>
    </form>
  );
}

export function NewRequisitionDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: (title: string) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="New job requisition" dismissOnBackdrop={false}>
      <RequisitionForm onClose={onClose} onSubmitted={onSubmitted} />
    </Dialog>
  );
}
