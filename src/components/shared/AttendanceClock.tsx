import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BuildingIcon, CameraIcon, ClockIcon, FingerprintIcon, HomeIcon, LoaderIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { FaceScanDialog } from "@/features/employee/FaceScanDialog";
import { formatElapsed } from "@/lib/format";
import { enrollFaceId } from "@/lib/api";
import { clockRemote, clockState, setWorkFromHome } from "@/lib/timekeeping/api";
import { isOwnWfh } from "@/lib/timekeeping/store";
import type { Punch } from "@/lib/timekeeping/types";
import { fmtTime } from "@/lib/preferences";

const time = (iso: string) => fmtTime(iso);
type Kind = "in" | "out";

/** The phone's location for a clock-in from home; never blocks clocking in if it can't be had. */
function currentLocation(): Promise<NonNullable<Punch["location"]>> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ unavailable: "This device can't share its location" });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5, accuracy: Math.round(p.coords.accuracy) }),
      (e) => resolve({ unavailable: e.code === e.PERMISSION_DENIED ? "Location permission was denied" : "Location couldn't be found" }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

/**
 * Attendance on the employee's Home. At the office the fingerprint and face scanners record it, so
 * this only shows what they caught. "Work from home" is the one action: for days at home, and the
 * backup when the office hardware isn't working. It clocks in and out with a face scan and saves the
 * location; the manager is notified, no approval needed. HR-declared remote days work the same way.
 */
export function AttendanceClock({ employeeId, personName, actor, needsEnrollment }: { employeeId?: string; personName?: string; actor: string; needsEnrollment?: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ["attendance-clock", employeeId] as const;
  const state = useQuery({ queryKey: key, queryFn: () => clockState(employeeId!), enabled: !!employeeId, staleTime: 0 });
  // "enroll": no Face ID yet, so the first face scan enrolls it and then clocks in.
  const [scan, setScan] = useState<Kind | "enroll" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [askWfh, setAskWfh] = useState(false);
  const [askOffice, setAskOffice] = useState(false);

  const remoteDay = state.data?.remoteDay;
  const office = state.data?.office;
  const inAt = state.data?.inAt;
  const outAt = state.data?.outAt;
  const since = remoteDay && inAt && !outAt ? new Date(inAt).getTime() : null;

  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
    queryClient.invalidateQueries({ queryKey: ["ess"] });
    queryClient.invalidateQueries({ queryKey: ["team-notices"] });
  };
  const record = useMutation({
    mutationFn: async (kind: Kind) => clockRemote(employeeId!, kind, 92 + Math.floor(Math.random() * 8), actor, "face", await currentLocation()),
    onSuccess: (p) => {
      refresh();
      const where = p.location && "lat" in p.location ? " Location saved." : " Location couldn't be saved.";
      toast.show(p.kind === "in" ? `Face verified. Clocked in from home at ${time(p.at)}.${where}` : `Clocked out at ${time(p.at)}. Stay safe${personName ? `, ${personName}` : ""}!`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't record it. Try again.", "critical"),
  });
  const wfh = useMutation({
    mutationFn: (on: boolean) => setWorkFromHome(employeeId!, on, actor),
    onSuccess: (_v, on) => {
      refresh();
      if (on) setScan(needsEnrollment ? "enroll" : "in");
      else toast.show("Back to an office day. The office scanners record your time.");
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't change it. Try again.", "critical"),
  });

  const faceDialog = (
    <FaceScanDialog
      open={scan !== null}
      mode={scan === "enroll" ? "enroll" : "verify"}
      onClose={() => setScan(null)}
      onSuccess={async () => {
        const kind = scan;
        setScan(null);
        if (kind === "enroll") {
          await enrollFaceId();
          queryClient.invalidateQueries({ queryKey: ["employee", "me"] });
          record.mutate("in");
        } else if (kind) record.mutate(kind);
      }}
    />
  );

  if (remoteDay) {
    return (
      <>
        {isOwnWfh(remoteDay) ? (
          <button
            type="button"
            onClick={() => (inAt ? setAskOffice(true) : wfh.mutate(false))}
            disabled={wfh.isPending}
            title="Switch back to an office day"
            className="flex items-center gap-1.5 rounded-lg border border-cat-1/30 bg-[color-mix(in_srgb,var(--color-cat-1)_10%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-cat-1 transition-colors hover:bg-[color-mix(in_srgb,var(--color-cat-1)_18%,transparent)] disabled:opacity-50"
          >
            <HomeIcon className="h-3.5 w-3.5" />
            Working from home
          </button>
        ) : (
          <span className="flex items-center gap-1.5 rounded-lg border border-cat-1/30 bg-[color-mix(in_srgb,var(--color-cat-1)_10%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-cat-1" title={remoteDay.reason}>
            <HomeIcon className="h-3.5 w-3.5" />
            Remote work day
          </span>
        )}
        {/* Shown while clocked in; gone once they clock out (the times are in My attendance). */}
        {inAt && !outAt && (
          <span className="flex items-center gap-1.5 rounded-lg border border-good/30 bg-good-tint px-2.5 py-1.5 text-xs font-semibold text-good">
            <ClockIcon className="h-3.5 w-3.5" />
            {`In from home at ${time(inAt)} · ${formatElapsed(now - new Date(inAt).getTime())}`}
          </span>
        )}
        {!employeeId && <span className="text-xs text-ink-2">Ask the Super Admin to link your sign-in to your employee record (Users) to clock in from home.</span>}
        {!outAt && employeeId && (
          <Button icon={record.isPending ? <LoaderIcon className="h-3.75 w-3.75 animate-spin" /> : <CameraIcon className="h-3.75 w-3.75" />} onClick={() => setScan(inAt ? "out" : needsEnrollment ? "enroll" : "in")} disabled={record.isPending || state.isLoading}>
            {record.isPending ? "Saving…" : inAt ? "Clock out (face scan)" : "Clock in (face scan)"}
          </Button>
        )}
        {faceDialog}
        <Dialog
          open={askOffice}
          onClose={() => setAskOffice(false)}
          title="Switch back to an office day?"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAskOffice(false)}>
                Keep working from home
              </Button>
              <Button
                icon={<BuildingIcon className="h-4 w-4" />}
                disabled={wfh.isPending}
                onClick={() => {
                  setAskOffice(false);
                  wfh.mutate(false);
                }}
              >
                Switch to office day
              </Button>
            </div>
          }
        >
          <p className="text-sm text-ink-2">
            Your {outAt ? `times from home today (${time(inAt!)} – ${time(outAt)})` : `time-in from home at ${time(inAt!)}`} will be set aside and won't count. The office scanners record your time instead. It stays on record, so your manager can see you switched.
          </p>
        </Dialog>
      </>
    );
  }

  // Office day: what the scanners caught, read-only.
  const scanned = office?.in;
  return (
    <>
      <span className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${scanned ? "border-good/30 bg-good-tint text-good" : "border-border bg-surface text-ink-2"}`} title="Recorded by the office fingerprint and face scanners">
        {scanned?.source === "face" ? <CameraIcon className="h-3.5 w-3.5" /> : scanned ? <FingerprintIcon className="h-3.5 w-3.5" /> : <BuildingIcon className="h-3.5 w-3.5" />}
        {state.isLoading ? "Checking the office scanners…" : scanned ? `Scanned in ${time(scanned.at)}${office?.out ? ` · out ${time(office.out.at)}` : ""} · ${scanned.source === "face" ? "face scanner" : scanned.source === "manual" ? "added by HR" : "fingerprint"}` : "No office scan yet today"}
      </span>
      {employeeId && (
        <Button variant="ghost" icon={<HomeIcon className="h-3.75 w-3.75" />} onClick={() => setAskWfh(true)} disabled={wfh.isPending}>
          Work from home
        </Button>
      )}
      <Dialog
        open={askWfh}
        onClose={() => setAskWfh(false)}
        title="Work from home today?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAskWfh(false)}>
              Cancel
            </Button>
            <Button
              icon={<CameraIcon className="h-4 w-4" />}
              disabled={wfh.isPending}
              onClick={() => {
                setAskWfh(false);
                wfh.mutate(true);
              }}
            >
              Clock in with a face scan
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-2 text-sm text-ink-2">
          <p>Use this when you work from home, or when the office scanner isn't working. You clock in and out with a face scan, and your location is saved with the time. Your manager is notified.</p>
          {scanned && <p className="text-warning">Your office scan at {time(scanned.at)} won't count for today.</p>}
          {needsEnrollment && <p>You haven't set up Face ID yet, so this first scan enrolls it.</p>}
        </div>
      </Dialog>
      {faceDialog}
    </>
  );
}
