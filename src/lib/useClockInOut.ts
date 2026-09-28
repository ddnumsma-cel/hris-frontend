import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/ToastContext";

/**
 * Shared onsite clock-in/out state for roles that don't need the
 * office/remote + face-scan flow (that richer version stays specific to
 * EmployeeOverview, which already has a Face ID enrollment concept to check
 * against — Manager/HR personas don't have an equivalent self-profile page).
 */
export function useClockInOut(personName?: string) {
  const toast = useToast();
  const [clockedIn, setClockedIn] = useState<Date | null>(null);
  const [scanning, setScanning] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!clockedIn) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [clockedIn]);

  function handleClockIn() {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      const clockInTime = new Date();
      setClockedIn(clockInTime);
      setNow(clockInTime);
      const time = clockInTime.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
      toast.show(`Clocked in at ${time} — confirmed by the office biometric scanner.`);
    }, 900);
  }

  function handleClockOut() {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setClockedIn(null);
      toast.show(`Clocked out${personName ? ` — have a good evening, ${personName}!` : "."}`);
    }, 900);
  }

  function handleClockToggle() {
    if (clockedIn) handleClockOut();
    else handleClockIn();
  }

  return { clockedIn, scanning, now, handleClockToggle };
}
