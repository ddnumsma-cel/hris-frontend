import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useToast } from "@/components/ui/ToastContext";
import { MailIcon, MapPinIcon, MoreVerticalIcon, PhoneIcon } from "@/components/icons";
import type { EmployeeSummary } from "@/lib/corehr/api";
import { formatDate, statusTone, tenure } from "./format";
import { Drawer, Initials, Pill } from "./ui";

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-[0.8rem] text-ink-2">
      <span className="flex-none text-ink-3 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** A quick look at someone without leaving the list. */
function PreviewPanel({ e, onClose }: { e: EmployeeSummary; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Drawer
      open
      onClose={onClose}
      title={e.name}
      subtitle={`${e.positionTitle} · ${e.id}`}
      footer={
        <button type="button" onClick={() => navigate(`/admin/people/${e.id}`)} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-sm font-medium text-surface">
          Open full profile
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Initials initials={e.initials} size="lg" />
          <div className="text-sm">
            <Pill tone={statusTone[e.status]}>{e.status}</Pill>
            <div className="mt-1 text-ink-2">{e.employmentType}</div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {(
            [
              ["Department", e.departmentName],
              ["Team", e.teamName],
              ["Branch", e.branchName],
              ["Hired", `${formatDate(e.dateHired)} · ${tenure(e.dateHired)}`],
              ["Work email", e.workEmail],
              ["Mobile", e.mobile],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-ink-3">{k}</dt>
              <dd className={clsx("mt-0.5 break-words", !v && "text-ink-3")}>{v || "Not added yet"}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">201 file</span>
            <span className="text-ink-2">
              {e.documents.verified} of {e.documents.required} verified
            </span>
          </div>
          {e.documents.needsAction > 0 && <div className="mt-1 text-xs font-medium text-warning">{e.documents.needsAction} documents need attention</div>}
        </div>
      </div>
    </Drawer>
  );
}

/** One employee as a contact card: who they are, how to reach them, their 201 file and status. */
export function EmployeeCard({ e, index }: { e: EmployeeSummary; index: number }) {
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState(false);
  const pct = e.documents.required ? Math.round((e.documents.verified / e.documents.required) * 100) : 100;
  const where = [e.branchName, e.teamName].filter(Boolean).join(" · ");

  return (
    <article style={{ "--i": index } as React.CSSProperties} className={clsx("rise-in lift relative flex flex-col rounded-2xl border border-border bg-surface px-4 py-3.5 shadow-sm", e.status === "Separated" && "opacity-60")}>
      <header className="flex items-start gap-2.5">
        <Initials initials={e.initials} size="lg" />
        <div className="min-w-0 flex-1 pt-0.5">
          <Link to={`/admin/people/${e.id}`} title={e.name} className="font-display line-clamp-2 text-[0.95rem] leading-tight font-semibold break-words hover:underline">
            {e.name}
          </Link>
          <span className="mt-0.5 line-clamp-2 text-xs text-ink-2" title={e.positionTitle}>
            {e.positionTitle}
          </span>
          <span className="mt-1.5 inline-flex">
            <Pill tone={statusTone[e.status]}>{e.employmentType === "Probationary" && e.status === "Active" ? "Probationary" : e.status}</Pill>
          </span>
        </div>
        <div className="relative -mr-1.5 flex-none">
          <button type="button" aria-label={`More for ${e.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
            <MoreVerticalIcon className="h-4 w-4" />
          </button>
          {menu && (
            <>
              <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
              <div role="menu" className="absolute top-8 right-0 z-20 flex w-44 flex-col rounded-xl border border-border bg-surface p-1 text-sm shadow-lg">
                <Link role="menuitem" to={`/admin/people/${e.id}`} className="rounded-lg px-3 py-1.5 hover:bg-surface-2">
                  View profile
                </Link>
                {e.workEmail && (
                  <a role="menuitem" href={`mailto:${e.workEmail}`} className="rounded-lg px-3 py-1.5 hover:bg-surface-2">
                    Send an email
                  </a>
                )}
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(e.id);
                    toast.show(`Copied ${e.id}.`);
                    setMenu(false);
                  }}
                  className="rounded-lg px-3 py-1.5 text-left hover:bg-surface-2"
                >
                  Copy employee ID
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <div className="my-3 border-t border-border" />

      <div className="flex flex-col gap-1.5">
        <span className="truncate text-[0.8rem] text-ink-2">
          Department: <span className="font-semibold text-ink">{e.departmentName}</span>
        </span>
        <Row icon={<MapPinIcon />}>
          {e.branchName}
          {e.teamName && <span className="text-ink-3"> · {e.teamName}</span>}
          {!where && "No branch yet"}
        </Row>
        <Row icon={<MailIcon />}>{e.workEmail || <span className="text-ink-3">No email yet</span>}</Row>
        <Row icon={<PhoneIcon />}>{e.mobile || <span className="text-ink-3">No phone yet</span>}</Row>
      </div>

      <div className="my-3 border-t border-border" />

      <div className="flex items-center gap-2.5 text-xs">
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <span className={clsx("grow-x block h-full rounded-full", pct === 100 ? "bg-good" : "bg-good/80")} style={{ width: `${Math.max(pct, 4)}%` }} />
        </span>
        <span className="flex-none text-ink-3">
          {e.documents.verified}/{e.documents.required} docs
        </span>
        {e.documents.needsAction > 0 && <span className="flex-none font-semibold text-warning">{e.documents.needsAction} pending</span>}
      </div>

      <div className="my-3 border-t border-border" />

      <footer className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-ink-3">
          Hired <span className="text-[0.8rem] text-ink-2">{formatDate(e.dateHired)}</span>
        </span>
        <span className="flex flex-none items-center">
          <button type="button" onClick={() => setPreview(true)} className="h-7 rounded-lg border border-brand px-2 text-xs font-semibold text-brand hover:bg-brand-tint">
            Preview
          </button>
        </span>
      </footer>

      {preview && <PreviewPanel e={e} onClose={() => setPreview(false)} />}
    </article>
  );
}
