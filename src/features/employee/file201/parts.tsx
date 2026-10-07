import type { ReactNode } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { CameraIcon, UploadIcon } from "@/components/icons";
import { cpdTone, type DocRow, type File201 } from "./useFile201";

/** A file picker that looks like whatever its className says. */
export function UploadAction({ row, f, className, children }: { row: DocRow; f: File201; className?: string; children?: ReactNode }) {
  return (
    <label className={clsx("cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-cat-1)]", f.busy && "pointer-events-none opacity-50", className)}>
      {children ?? (
        <>
          <UploadIcon className="h-3.5 w-3.5" />
          {row.uploadLabel}
        </>
      )}
      <input type="file" accept={row.accept} className="sr-only" disabled={f.busy} onChange={(e) => f.pickFile(row, e.target.files)} />
    </label>
  );
}

export function RemoveAction({ row, f }: { row: DocRow; f: File201 }) {
  return (
    <button type="button" onClick={() => f.removeDoc(row)} disabled={f.busy} className="text-xs font-semibold text-critical hover:underline disabled:opacity-50">
      Remove
    </button>
  );
}

export function Avatar({ f, className }: { f: File201; className: string }) {
  if (f.photo) return <img src={f.photo} alt="" className={clsx("flex-none object-cover", className)} />;
  return <span className={clsx("flex flex-none items-center justify-center font-semibold", className)}>{f.employee?.initials ?? ""}</span>;
}

export function Bar({ percent, tone = "brand" }: { percent: number; tone?: "brand" | "crit" }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
      <span className={clsx("block h-full rounded-full", tone === "crit" ? "bg-critical" : "bg-brand")} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

export function LicensePanel({ f }: { f: File201 }) {
  const { license, cpd } = f;
  if (!license || !cpd) return <p className="text-sm text-ink-2">No professional license on file.</p>;
  const pct = Math.round((license.cpdUnitsEarned / license.cpdUnitsRequired) * 100);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[0.9rem] font-semibold">{license.licenseType} · No. {license.licenseNumber}</div>
          <div className="text-xs text-ink-2">CPD cycle ends {license.cycleEndDate}</div>
        </div>
        <Chip variant={cpdTone[cpd.status]}>{cpd.status}</Chip>
      </div>
      <div className="flex justify-between text-xs text-ink-2">
        <span>CPD units</span>
        <span className="font-num font-semibold text-ink">{cpd.note}</span>
      </div>
      <Bar percent={pct} tone={cpd.status === "Overdue" ? "crit" : "brand"} />
      <Button variant="ghost" className="self-start" onClick={f.logCpd}>
        Log CPD units
      </Button>
    </div>
  );
}

export function FacePanel({ f }: { f: File201 }) {
  const enrolled = f.employee?.faceEnrolled;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.9rem] font-semibold">{enrolled ? "Enrolled" : "Not enrolled"}</span>
        <Chip variant={enrolled ? "good" : "neutral"}>{enrolled ? "Enrolled" : "Not enrolled"}</Chip>
      </div>
      <p className="text-xs text-ink-2">{enrolled ? "You can clock in remotely using a face scan." : "Enroll your face to clock in when working from home."}</p>
      {!enrolled && f.employee && (
        <Button variant="ghost" className="self-start" icon={<CameraIcon className="h-3.75 w-3.75" />} onClick={f.enrollFace}>
          Enroll Face ID
        </Button>
      )}
    </div>
  );
}

export function AssetsPanel({ f }: { f: File201 }) {
  if (!f.assets) return <Skeleton className="h-16 w-full" />;
  if (f.assets.length === 0) return <p className="text-sm text-ink-2">No company assets are issued to you.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {f.assets.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
          <div>
            <div className="text-[0.85rem] font-semibold">{a.type}</div>
            <div className="text-xs text-ink-2">
              {a.assetTag} · Issued {a.issuedOn}
            </div>
          </div>
          <Chip variant={a.status === "Issued" ? "good" : a.status === "Under repair" ? "warn" : "neutral"}>{a.status}</Chip>
        </li>
      ))}
    </ul>
  );
}
