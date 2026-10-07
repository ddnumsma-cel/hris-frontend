import { useState } from "react";
import clsx from "clsx";
import { Chip, type ChipVariant } from "@/components/ui/Chip";
import { CheckCircleIcon, FileIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { AssetsPanel, Avatar, Bar, FacePanel, LicensePanel, RemoveAction, UploadAction } from "./parts";
import { linkClass, shortDate, type File201 } from "./useFile201";

type Tab = "documents" | "license" | "assets" | "face";

const tile: Record<ChipVariant, string> = {
  crit: "bg-critical-tint text-critical",
  warn: "bg-warning-tint text-warning",
  good: "bg-good-tint text-good",
  neutral: "bg-surface-2 text-ink-2",
};

/** ID card on the left; the rest in tabs. */
export function File201View({ f }: { f: File201 }) {
  const [tab, setTab] = useState<Tab>("documents");
  const [onlyAction, setOnlyAction] = useState(false);
  const e = f.employee;
  const needs = f.docs.filter((d) => d.needsAction).length;
  const licenseAlert = f.cpd?.status === "Overdue" || f.cpd?.status === "Due soon";
  const tabs: { id: Tab; label: string; badge?: string; alert?: boolean }[] = [
    { id: "documents", label: "Documents", badge: String(f.docs.length), alert: needs > 0 },
    ...(f.license ? [{ id: "license" as const, label: "License & CPD", badge: licenseAlert ? "!" : undefined, alert: licenseAlert }] : []),
    { id: "assets", label: "Assets", badge: f.assets ? String(f.assets.length) : undefined },
    { id: "face", label: "Face ID", badge: e && !e.faceEnrolled ? "!" : undefined },
  ];
  const rows = onlyAction ? f.docs.filter((d) => d.needsAction) : f.docs;
  const pct = f.docs.length ? Math.round((f.onFile / f.docs.length) * 100) : 0;
  const actionDocs = f.docs.filter((d) => d.needsAction);
  const breakdown = [
    { label: "Verified by HR", count: f.verified, dot: "bg-good" },
    { label: "Waiting for HR", count: f.docs.filter((d) => !d.needsAction && d.item.status === "Submitted").length, dot: "bg-ink-3" },
    { label: "Needs your action", count: actionDocs.length, dot: "bg-critical" },
  ];
  const lastUpload = f.docs.map((d) => d.item.uploadedOn).filter(Boolean).sort().at(-1);

  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-stretch">
      <aside className="flex w-full min-w-0 flex-col gap-4 lg:w-[340px] lg:flex-none lg:self-stretch">
        <div className="flex flex-col gap-5 rounded-2xl bg-brand-dark p-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold tracking-wide">heyhr</span>
            <span className="text-[0.65rem] font-semibold tracking-[0.12em] text-[#bfe36b]">EMPLOYEE</span>
          </div>
          <div className="flex items-center gap-4">
            <Avatar f={f} className="h-24 w-20 rounded-xl bg-white/10 text-2xl text-[#bfe36b]" />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="font-display text-lg leading-tight font-semibold">{e?.name ?? <Skeleton className="h-5 w-32" />}</div>
              <div className="text-xs text-white/75">{e?.position}</div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-[0.7rem] text-white/65">ID number</dt>
              <dd className="font-num font-semibold tracking-wide">{e?.id ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[0.7rem] text-white/65">Status</dt>
              <dd className="font-semibold text-[#bfe36b]">{e?.status ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[0.7rem] text-white/65">Department</dt>
              <dd>{e?.department ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[0.7rem] text-white/65">Office</dt>
              <dd>{e?.office ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 text-sm">
          <h2 className="font-display text-sm font-semibold">Contact</h2>
          <div>
            <div className="text-xs text-ink-2">Email</div>
            <div className="break-words">{e?.email ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-ink-2">Phone</div>
            <div>{e?.phone ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-ink-2">Emergency contact</div>
            <div>{e?.emergencyContact ?? "—"}</div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 lg:flex-1">
          <h2 className="font-display text-sm font-semibold">File completeness</h2>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold">{pct}%</span>
              <span className="text-xs text-ink-2">
                {f.onFile} of {f.docs.length} documents on file
              </span>
            </div>
            <Bar percent={pct} />
          </div>

          <ul className="flex flex-col gap-2 text-sm">
            {breakdown.map((b) => (
              <li key={b.label} className="flex items-center gap-2.5">
                <span className={clsx("h-2.5 w-2.5 flex-none rounded-full", b.dot)} />
                <span className="flex-1 text-ink-2">{b.label}</span>
                <span className="font-num font-semibold">{b.count}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="text-xs font-semibold text-ink-2">{actionDocs.length ? "To do" : "All set"}</h3>
            {actionDocs.length ? (
              <ul className="flex flex-col gap-2">
                {actionDocs.map((r) => (
                  <li key={r.item.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[0.8rem] font-medium">{r.item.type}</span>
                      <span className={clsx("text-xs", r.tone === "crit" ? "text-critical" : "text-warning")}>{r.meta}</span>
                    </div>
                    <UploadAction row={r} f={f} className={linkClass} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-xs text-ink-2">
                <CheckCircleIcon className="h-4 w-4 text-good" />
                Nothing needs your action.
              </p>
            )}
          </div>

          <p className="mt-auto border-t border-border pt-4 text-xs text-ink-2">
            {lastUpload ? `Last upload ${shortDate(lastUpload)}. ` : ""}HR verifies each upload. Verified documents are locked; ask HR if one needs changing.
          </p>
        </section>
      </aside>

      <main className="flex w-full min-w-0 flex-1 flex-col gap-4">
        <nav aria-label="201 file sections" className="flex flex-wrap gap-6 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
              className={clsx("-mb-px inline-flex min-h-11 items-center gap-2 border-b-[3px] text-sm", tab === t.id ? "border-brand font-semibold text-ink" : "border-transparent font-medium text-ink-2 hover:text-ink")}
            >
              {t.label}
              {t.badge && <span className={clsx("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-semibold", t.alert || t.badge === "!" ? "bg-critical-tint text-critical" : "bg-surface-2 text-ink-2")}>{t.badge}</span>}
            </button>
          ))}
        </nav>

        {tab === "documents" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex-[1_1_320px] text-xs text-ink-2">Upload or replace your pre-employment and identity records. HR verifies each one; verified documents are locked.</p>
              <div role="group" aria-label="Filter documents" className="flex gap-2">
                {[
                  { on: false, label: "All" },
                  { on: true, label: `Needs action · ${needs}` },
                ].map((o) => (
                  <button key={o.label} type="button" aria-pressed={onlyAction === o.on} onClick={() => setOnlyAction(o.on)} className={clsx("rounded-full border px-3.5 py-1.5 text-xs font-medium", onlyAction === o.on ? "border-ink bg-ink text-surface" : "border-border bg-surface text-ink")}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col overflow-x-auto rounded-2xl border border-border bg-surface lg:flex-1">
              <div className="flex min-w-[560px] flex-1 flex-col">
                <div className="grid grid-cols-[minmax(0,1fr)_7.5rem_10rem] items-center gap-4 border-b border-border px-5 py-3 text-xs font-semibold text-ink-2">
                  <span>Document</span>
                  <span>Status</span>
                  <span className="text-right">Action</span>
                </div>
                {f.docsLoading && <Skeleton className="m-5 h-40" />}
                <ul className="flex flex-1 flex-col divide-y divide-surface-2">
                  {rows.map((r) => (
                    <li key={r.item.id} className="grid max-h-24 min-h-16 flex-1 grid-cols-[minmax(0,1fr)_7.5rem_10rem] items-center gap-4 px-5 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={clsx("flex h-10 w-10 flex-none items-center justify-center rounded-xl", tile[r.tone])}>
                          <FileIcon className="h-4.5 w-4.5" />
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">{r.item.type}</span>
                          <span className="truncate text-xs text-ink-2">{r.meta}</span>
                        </div>
                      </div>
                      <span>
                        <Chip variant={r.tone}>{r.label}</Chip>
                      </span>
                      <span className="flex justify-end gap-3">
                        {r.uploadLabel ? <UploadAction row={r} f={f} className={linkClass} /> : <span className="text-xs text-ink-3">Locked</span>}
                        {r.canRemove && <RemoveAction row={r} f={f} />}
                      </span>
                    </li>
                  ))}
                  {!f.docsLoading && rows.length === 0 && (
                    <li className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                      <CheckCircleIcon className="h-6 w-6 text-good" />
                      <span className="text-sm font-medium">Nothing needs your action</span>
                      <span className="text-xs text-ink-2">Every required document is on file.</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
        {tab === "license" && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <LicensePanel f={f} />
          </div>
        )}
        {tab === "assets" && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <AssetsPanel f={f} />
          </div>
        )}
        {tab === "face" && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <FacePanel f={f} />
          </div>
        )}
      </main>
    </div>
  );
}
