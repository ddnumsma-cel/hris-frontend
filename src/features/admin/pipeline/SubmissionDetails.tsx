import type { ReactNode } from "react";
import { CheckCircleIcon } from "@/components/icons";
import { maskGovId } from "@/lib/govIds";
import type { OnboardingSubmission } from "@/lib/types";

function Detail({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === undefined || children === null || children === "";
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 py-1.5 text-sm">
      <dt className="text-ink-2">{label}</dt>
      <dd className={empty ? "text-ink-3" : "font-medium break-words"}>{empty ? "Not added" : children}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[0.7rem] font-semibold tracking-[0.06em] text-ink-3 uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Everything a new hire sent in Onboarding, read-only, for HR reviewing it. */
export function SubmissionDetails({ submission }: { submission: OnboardingSubmission }) {
  const i = submission.input;
  const gov = i.governmentNumbers ?? {};
  const spouse = i.dependents?.find((d) => d.relationship === "Spouse");
  const files = (i.uploadedDocuments ?? []).filter((u) => !(i.governmentId && u.type === "Valid Government ID"));
  return (
    <div className="flex flex-col gap-5">
      <Group title="Personal">
        <dl>
          <Detail label="Full name">{[i.firstName, i.middleName, i.lastName, i.suffix].filter(Boolean).join(" ")}</Detail>
          <Detail label="Birth date">{i.birthDate}</Detail>
          {i.civilStatus && <Detail label="Civil status">{i.civilStatus}</Detail>}
          {spouse && <Detail label="Spouse">{spouse.name}</Detail>}
          {i.bloodType && <Detail label="Blood type">{i.bloodType}</Detail>}
        </dl>
      </Group>
      <Group title="Contact">
        <dl>
          <Detail label="Mobile">{i.phone}</Detail>
          {i.personalEmail && <Detail label="Personal email">{i.personalEmail}</Detail>}
          {i.email && <Detail label="Work email">{i.email}</Detail>}
          {i.address && <Detail label="Home address">{i.address}</Detail>}
          {i.emergencyContact && (
            <Detail label="Emergency contact">
              {i.emergencyContact.name}
              {i.emergencyContact.relationship ? ` (${i.emergencyContact.relationship})` : ""}
              {i.emergencyContact.phone ? ` · ${i.emergencyContact.phone}` : ""}
            </Detail>
          )}
        </dl>
      </Group>
      {(i.otherDetails?.length ?? 0) > 0 && (
        <Group title="Other details">
          <dl>
            {i.otherDetails!.map((d) => (
              <Detail key={d.label} label={d.label}>
                {d.value}
              </Detail>
            ))}
          </dl>
        </Group>
      )}
      <Group title="Government numbers">
        <dl>
          <Detail label="TIN">{gov.tin && maskGovId(gov.tin)}</Detail>
          <Detail label="SSS">{gov.sss && maskGovId(gov.sss)}</Detail>
          <Detail label="PhilHealth">{gov.philHealth && maskGovId(gov.philHealth)}</Detail>
          <Detail label="Pag-IBIG">{gov.pagIbig && maskGovId(gov.pagIbig)}</Detail>
        </dl>
      </Group>
      <Group title="Uploaded 201 files">
        <ul className="flex flex-col gap-1.5 py-1.5 text-sm">
          {i.governmentId && (
            <li className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 flex-none text-good" />
              Valid Government ID <span className="text-ink-3">· {i.governmentId.idType}</span>
            </li>
          )}
          {files.map((u) => (
            <li key={u.type} className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 flex-none text-good" />
              <span className="min-w-0 truncate">
                {u.type} <span className="text-ink-3">· {u.fileName}</span>
              </span>
            </li>
          ))}
          {!i.governmentId && files.length === 0 && <li className="text-ink-3">No files uploaded yet</li>}
        </ul>
      </Group>
    </div>
  );
}
