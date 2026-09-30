import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon, CheckCircleIcon, EditIcon } from "@/components/icons";
import { fetchEmployeeDirectory, previewEmployeeId, type PossibleDuplicate } from "@/lib/api";
import { formatPhMobile, govIdFormats, maskGovId } from "@/lib/govIds";
import type { AddEmployeeFormValues } from "@/lib/schemas";
import { StepHeading } from "./fields";
import type { IdScan } from "./useIdScan";
import { composeAddress, coreDocuments, stillNeededBeforePayroll } from "./model";

function formatDate(iso: string) {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "";
}

function Row({ label, value }: { label: string; value?: ReactNode }) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-3 py-1.5 text-sm sm:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)]">
      <dt className="text-ink-2">{label}</dt>
      <dd className={empty ? "text-ink-3" : "font-medium break-words"}>{empty ? "Not added" : value}</dd>
    </div>
  );
}

function SectionCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-[0.9rem] font-semibold">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-ink hover:bg-surface-2"
          aria-label={`Edit ${title.toLowerCase()}`}
        >
          <EditIcon className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
      <dl>{children}</dl>
    </section>
  );
}

export function ReviewStep({
  idScan,
  duplicates,
  duplicateAcknowledged,
  onAcknowledgeDuplicate,
  onEdit,
}: {
  idScan: IdScan;
  duplicates: PossibleDuplicate[];
  duplicateAcknowledged: boolean;
  onAcknowledgeDuplicate: () => void;
  onEdit: (step: number) => void;
}) {
  const { control } = useFormContext<AddEmployeeFormValues>();
  const v = useWatch({ control }) as AddEmployeeFormValues;
  const directoryQuery = useQuery({ queryKey: ["admin", "employee-directory"], queryFn: fetchEmployeeDirectory });
  const manager = directoryQuery.data?.find((e) => e.id === v.reportsToId);
  const stillNeeded = stillNeededBeforePayroll(v);
  const idPreview = v.lastName && v.firstName && v.dateHired ? previewEmployeeId(v) : null;
  const fullName = [v.firstName, v.middleName, v.lastName, v.suffix].filter(Boolean).join(" ");
  const receivedCount = coreDocuments.filter(
    (t) => v.receivedDocuments?.includes(t) || (t === "Valid Government ID" && idScan.governmentId),
  ).length;

  return (
    <>
      <StepHeading title="Check and create" description="Everything below can still be changed later from their 201 file." legend={false} />

      {duplicates.length > 0 && (
        <div
          role="alert"
          className={`mb-5 rounded-xl border px-4 py-3.5 ${duplicateAcknowledged ? "border-border bg-surface-2" : "border-warning/40 bg-warning-tint"}`}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangleIcon className={`mt-0.5 h-4 w-4 flex-none ${duplicateAcknowledged ? "text-ink-3" : "text-warning"}`} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">
                {duplicateAcknowledged ? "Marked as a different person" : "This may already be in the directory"}
              </p>
              <ul className="mt-1 flex flex-col gap-1">
                {duplicates.map((d) => (
                  <li key={d.employee.id}>
                    <span className="font-medium">{d.employee.name}</span>{" "}
                    <span className="text-ink-2">
                      ({d.employee.id} · {d.employee.position}) — {d.reason.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
              {!duplicateAcknowledged && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/admin/directory?employee=${duplicates[0].employee.id}`}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-brand"
                  >
                    Open existing 201 file
                  </Link>
                  <Button type="button" size="sm" variant="ghost" onClick={onAcknowledgeDuplicate}>
                    It's a different person, continue
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mb-5 rounded-xl border border-border px-4 py-3.5">
        <p className="text-sm font-semibold">{stillNeeded.length > 0 ? "Still needed before first payroll" : "Nothing missing"}</p>
        {stillNeeded.length > 0 ? (
          <>
            <ul className="mt-2 flex flex-wrap gap-2">
              {stillNeeded.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => onEdit(item.step)}
                    className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-ink hover:border-brand-ink"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-2">You can create the record now and add these from the 201 file.</p>
          </>
        ) : (
          <p className="mt-1 text-xs text-ink-2">Everything payroll needs is here.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Identity" onEdit={() => onEdit(0)}>
          <Row label="Full name" value={fullName} />
          <Row label="Nickname" value={v.nickname} />
          <Row label="Birth date" value={formatDate(v.birthDate)} />
          <Row label="Sex" value={v.sex} />
          <Row label="Civil status" value={v.civilStatus} />
          <Row label="Blood type" value={v.bloodType} />
        </SectionCard>
        <SectionCard title="Contact" onEdit={() => onEdit(1)}>
          <Row label="Mobile" value={v.phone && formatPhMobile(v.phone)} />
          <Row label="Personal email" value={v.personalEmail} />
          <Row label="Work email" value={v.email} />
          <Row label="Address" value={composeAddress(v)} />
          <Row
            label="Emergency contact"
            value={
              v.emergencyName &&
              `${v.emergencyName}${v.emergencyRelationship ? ` (${v.emergencyRelationship})` : ""}${v.emergencyPhone ? ` · ${formatPhMobile(v.emergencyPhone)}` : ""}`
            }
          />
        </SectionCard>
        <SectionCard title="Employment" onEdit={() => onEdit(2)}>
          <Row label="Position" value={v.position} />
          <Row label="Department" value={v.department && `${v.department}${v.cluster && v.department === "Accounting" ? ` · ${v.cluster}` : ""}`} />
          <Row label="Office" value={v.office} />
          <Row label="Status" value={v.employmentStatus} />
          <Row label="Date hired" value={formatDate(v.dateHired)} />
          <Row label="Employee ID" value={idPreview?.id} />
          <Row label="Reports to" value={manager ? manager.name : "HR & People Operations"} />
        </SectionCard>
        <SectionCard title="Gov't IDs & documents" onEdit={() => onEdit(3)}>
          {govIdFormats.map((f) => (
            <Row key={f.key} label={f.label} value={v[f.key] && maskGovId(v[f.key])} />
          ))}
          <Row label="201 documents" value={`${receivedCount} of ${coreDocuments.length} received`} />
        </SectionCard>
      </div>

      <div className="mt-5 rounded-xl border border-border px-4 py-3.5">
        <p className="text-sm font-semibold">When you create this employee</p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink-2">
          {[
            `A 201 file opens for ${v.firstName || "them"}, with ${coreDocuments.length - receivedCount} documents marked as still needed`,
            "They're added to the onboarding pipeline",
            idPreview ? `They appear in the Employee Directory as ${idPreview.id}` : "They appear in the Employee Directory",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-good" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
