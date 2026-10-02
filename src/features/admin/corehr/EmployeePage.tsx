import { Link, useParams } from "react-router-dom";
import { ArrowRightIcon } from "@/components/icons";
import { EmployeeRecord } from "./EmployeeRecordPage";

/** One person's 201 file as its own page, opened from People. */
export function EmployeePage() {
  const { employeeId = "" } = useParams();
  return (
    <>
      <Link to="/admin/people" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowRightIcon className="h-4 w-4 rotate-180" />
        Back to People
      </Link>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <EmployeeRecord key={employeeId} employeeId={employeeId} />
      </div>
    </>
  );
}
