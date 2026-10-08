import { ClockIcon, LoaderIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { formatElapsed } from "@/lib/format";
import { useClockInOut } from "@/lib/useClockInOut";
import { fmtTime } from "@/lib/preferences";

export function ClockInOutControl({ personName }: { personName?: string }) {
  const { clockedIn, scanning, now, handleClockToggle } = useClockInOut(personName);

  return (
    <>
      {clockedIn && (
        <span className="flex items-center gap-1.5 rounded-lg border border-good/30 bg-good-tint px-2.5 py-1.5 text-xs font-semibold text-good">
          <ClockIcon className="h-3.5 w-3.5" />
          Clocked in at {fmtTime(clockedIn)} ·{" "}
          {formatElapsed(now.getTime() - clockedIn.getTime())}
        </span>
      )}
      <Button
        variant="ghost"
        icon={
          scanning ? (
            <LoaderIcon className="h-3.75 w-3.75 animate-spin" />
          ) : (
            <ClockIcon className="h-3.75 w-3.75" />
          )
        }
        onClick={handleClockToggle}
        disabled={scanning}
      >
        {scanning
          ? clockedIn
            ? "Clocking out…"
            : "Confirming with office scanner…"
          : clockedIn
            ? "Clock Out"
            : "Clock In"}
      </Button>
    </>
  );
}
