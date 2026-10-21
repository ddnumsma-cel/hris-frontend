import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useToast } from "@/components/ui/ToastContext";
import { CopyIcon, EditIcon, EyeIcon, FileIcon, MailIcon, MapPinIcon, MoreVerticalIcon, PhoneIcon, TrashIcon } from "@/components/icons";
import { useCan } from "@/lib/useCan";
import type { EmployeeSummary } from "@/lib/corehr/api";
import { useTilt } from "@/lib/useTilt";
import { formatDate, statusTone, tenure } from "./format";
import { DeletePersonDialog, EditPersonDialog } from "./PersonActions";
import { Drawer, Initials, Pill } from "./ui";

const menuItem = "flex h-8 items-center gap-2 rounded-lg px-2 text-left text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink";
const menuIcon = "h-4 w-4 flex-none text-ink-3";

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
        <button type="button" onClick={() => navigate(`/admin/maintenance/people/${e.id}`)} className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-sm font-medium text-bg">
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
            <span className="font-medium">201 documents</span>
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
  const [editing, setEditing] = useState(false);
  const canEdit = useCan("edit", "people");
  const canDelete = useCan("delete", "people");
  const [deleting, setDeleting] = useState(false);
  // Closes on any click outside the menu (including another card's ⋮) or Escape. A full-screen
  // catcher can't do this here: the card's lift transform confines fixed children to the card.
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (ev: PointerEvent) => {
      if (!menuRef.current?.contains(ev.target as Node)) setMenu(false);
    };
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    toast.show(`Copied ${text}.`);
    setMenu(false);
  };
  const where = [e.branchName, e.teamName].filter(Boolean).join(" · ");
  // Leans toward the pointer; flat while its menu is open.
  const tilt = useTilt<HTMLElement>(menu);

  // The wrapper rises in and holds the grid cell; the card inside tilts (an animation would hold its transform).
  return (
    <div style={{ "--i": index } as React.CSSProperties} className={clsx("rise-in relative flex", menu && "z-30")}>
    <article ref={tilt} className={clsx("tilt-card relative flex w-full flex-col rounded-2xl border border-border bg-surface px-4 py-3.5", e.status === "Separated" && "opacity-60")}>
      <span aria-hidden="true" className="tilt-glare" />
      <header className="flex h-[4.25rem] items-start gap-2.5">
        <Initials initials={e.initials} size="md" />
        <div className="min-w-0 flex-1 pt-0.5">
          <Link to={`/admin/maintenance/people/${e.id}`} title={e.name} className="font-display block truncate text-[0.95rem] leading-tight font-semibold hover:underline">
            {e.name}
          </Link>
          <span className="mt-0.5 block truncate text-xs text-ink-2" title={e.positionTitle}>
            {e.positionTitle}
          </span>
          <span className="mt-1.5 inline-flex">
            <Pill tone={statusTone[e.status]}>{e.employmentType === "Probationary" && e.status === "Active" ? "Probationary" : e.status}</Pill>
          </span>
        </div>
        <div ref={menuRef} className="relative -mr-1.5 flex-none">
          <button type="button" aria-label={`More for ${e.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
            <MoreVerticalIcon className="h-4 w-4" />
          </button>
          {menu && (
            <>
              <div role="menu" className="glass-surface absolute top-8 right-0 z-20 flex w-56 flex-col rounded-[var(--radius-dropdown)] p-1 text-sm">
                <Link role="menuitem" to={`/admin/maintenance/people/${e.id}`} className={menuItem}>
                  <EyeIcon aria-hidden="true" className={menuIcon} />
                  View profile
                </Link>
                {canEdit && (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      setEditing(true);
                    }}
                    className={menuItem}
                  >
                    <EditIcon aria-hidden="true" className={menuIcon} />
                    Edit
                  </button>
                )}
                <Link role="menuitem" to={`/admin/maintenance/people/${e.id}#documents`} className={menuItem}>
                  <FileIcon aria-hidden="true" className={menuIcon} />
                  <span className="flex-1">201 documents</span>
                  <span className="text-xs text-ink-3">
                    {e.documents.verified}/{e.documents.required}
                  </span>
                </Link>
                {(e.workEmail || e.mobile) && <div className="my-1 border-t border-border" />}
                {e.workEmail && (
                  <a role="menuitem" href={`mailto:${e.workEmail}`} onClick={() => setMenu(false)} className={menuItem}>
                    <MailIcon aria-hidden="true" className={menuIcon} />
                    Send an email
                  </a>
                )}
                {e.mobile && (
                  <a role="menuitem" href={`tel:${e.mobile.replace(/\s/g, "")}`} onClick={() => setMenu(false)} className={menuItem}>
                    <PhoneIcon aria-hidden="true" className={menuIcon} />
                    Call
                  </a>
                )}
                <div className="my-1 border-t border-border" />
                <button role="menuitem" type="button" onClick={() => copy(e.id)} className={menuItem}>
                  <CopyIcon aria-hidden="true" className={menuIcon} />
                  Copy employee ID
                </button>
                {e.workEmail && (
                  <button role="menuitem" type="button" onClick={() => copy(e.workEmail)} className={menuItem}>
                    <CopyIcon aria-hidden="true" className={menuIcon} />
                    Copy email
                  </button>
                )}
                {canDelete && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setMenu(false);
                        setDeleting(true);
                      }}
                      className="delete-action flex h-8 items-center gap-2 rounded-lg border px-2 text-left transition-colors duration-150"
                    >
                      <TrashIcon aria-hidden="true" className="h-4 w-4 flex-none" />
                      Delete
                    </button>
                  </>
                )}
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

      <div className="mt-auto pt-3">
        <div className="mb-3 border-t border-border" />
      </div>

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
      {deleting && <DeletePersonDialog e={e} onClose={() => setDeleting(false)} />}
      {editing && <EditPersonDialog employeeId={e.id} onClose={() => setEditing(false)} />}
    </article>
    </div>
  );
}
