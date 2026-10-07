import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BuildingIcon, ClockIcon, HomeIcon, LoaderIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { FaceScanDialog } from "@/features/employee/FaceScanDialog";
import { formatElapsed } from "@/lib/format";
import { clockRemote, clockState } from "@/lib/timekeeping/api";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

/**
 * Clock in and out. On a remote work day HR declared (typhoon, emergency), it's a
 * face scan from home that goes into the attendance record. Any other day the office
 * scanner records attendance, and this only confirms it.
 */
export function AttendanceClock({ employeeId, personName, actor, needsEnrollment }: { employeeId?: string; personName?: string; actor: string; needsEnrollment?: boolean }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = ["attendance-clock", employeeId] as const;
  const state = useQuery({ queryKey: key, queryFn: () => clockState(employeeId!), enabled: !!employeeId, staleTime: 0 });
  const [scan, setScan] = useState<"in" | "out" | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Office days: the scanner records it; this is the confirmation shown here.
  const [officeIn, setOfficeIn] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const remoteDay = state.data?.remoteDay;
  const inAt = state.data?.inAt;
  const outAt = state.data?.outAt;
  const since = remoteDay ? (inAt && !outAt ? new Date(inAt).getTime() : null) : officeIn;

  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);

  const record = useMutation({
    mutationFn: (kind: "in" | "out") => clockRemote(employeeId!, kind, 92 + Math.floor(Math.random() * 8), actor),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] });
      queryClient.invalidateQueries({ queryKey: ["ess"] });
      toast.show(p.kind === "in" ? `Face verified. Clocked in from home at ${time(p.at)}.` : `Clocked out at ${time(p.at)}. Stay safe${personName ? `, ${personName}` : ""}!`);
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : "Couldn't record it. Try again.", "critical"),
  });

  if (remoteDay) {
    const start = () => {
      if (needsEnrollment) {
        toast.show("Enroll your Face ID under 201 File first, then clock in from home.", "critical");
        return;
      }
      setScan(inAt ? "out" : "in");
    };
    return (
      <>
        <span className="flex items-center gap-1.5 rounded-lg border border-cat-1/30 bg-[color-mix(in_srgb,var(--color-cat-1)_10%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-cat-1" title={remoteDay.reason}>
          <HomeIcon className="h-3.5 w-3.5" />
          Remote work day
        </span>
        {inAt && (
          <span className="flex items-center gap-1.5 rounded-lg border border-good/30 bg-good-tint px-2.5 py-1.5 text-xs font-semibold text-good">
            <ClockIcon className="h-3.5 w-3.5" />
            {outAt ? `From home ${time(inAt)} – ${time(outAt)}` : `In from home at ${time(inAt)} · ${formatElapsed(now - new Date(inAt).getTime())}`}
          </span>
        )}
        {!employeeId && <span className="text-xs text-ink-2">Ask the Super Admin to link your sign-in to your employee record (Users) to clock in from home.</span>}
        {!outAt && employeeId && (
          <Button icon={record.isPending ? <LoaderIcon className="h-3.75 w-3.75 animate-spin" /> : <HomeIcon className="h-3.75 w-3.75" />} onClick={start} disabled={record.isPending || !employeeId || state.isLoading}>
            {inAt ? "Clock out (face scan)" : "Clock in from home"}
          </Button>
        )}
        <FaceScanDialog
          open={scan !== null}
          mode="verify"
          onClose={() => setScan(null)}
          onSuccess={() => {
            const kind = scan;
            setScan(null);
            if (kind) record.mutate(kind);
          }}
        />
      </>
    );
  }

  const toggle = () => {
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      if (officeIn) {
        setOfficeIn(null);
        toast.show(`Clocked out${personName ? `, have a good evening, ${personName}` : ""}.`);
      } else {
        const t = Date.now();
        setOfficeIn(t);
        setNow(t);
        toast.show(`Clocked in at ${time(new Date(t).toISOString())}, confirmed by the office biometric scanner.`);
      }
    }, 900);
  };
  return (
    <>
      <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2" title="Remote clock-in opens when HR declares a remote work day, for example during a typhoon.">
        <BuildingIcon className="h-3.5 w-3.5" />
        Office day
      </span>
      {officeIn && (
        <span className="flex items-center gap-1.5 rounded-lg border border-good/30 bg-good-tint px-2.5 py-1.5 text-xs font-semibold text-good">
          <ClockIcon className="h-3.5 w-3.5" />
          Clocked in at {time(new Date(officeIn).toISOString())} · {formatElapsed(now - officeIn)}
        </span>
      )}
      <Button variant="ghost" icon={confirming ? <LoaderIcon className="h-3.75 w-3.75 animate-spin" /> : <ClockIcon className="h-3.75 w-3.75" />} onClick={toggle} disabled={confirming}>
        {confirming ? (officeIn ? "Clocking out…" : "Confirming with office scanner…") : officeIn ? "Clock Out" : "Clock In"}
      </Button>
    </>
  );
}
