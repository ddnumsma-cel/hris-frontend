import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastContext";
import { enrollFaceId, fetchCurrentEmployee } from "@/lib/api";
import { signInTime } from "@/lib/session";
import { TOUR_DONE_EVENT, tourDone } from "@/components/shared/FirstLoginTour";
import { FaceScanDialog } from "./FaceScanDialog";

const LATER_KEY = "heyhr-face-prompt-later";

function laterThisSignIn() {
  try {
    return localStorage.getItem(LATER_KEY) === signInTime();
  } catch {
    return false;
  }
}

/**
 * Right after signing in, an employee without Face ID is asked to enroll it, since attendance
 * clock-ins use a face scan (after the first-login walkthrough). "Later" hides it until the next sign-in.
 */
export function FaceIdPrompt() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["employee", "me"], queryFn: fetchCurrentEmployee });
  const [later, setLater] = useState(laterThisSignIn);
  const [scanning, setScanning] = useState(false);
  // Wait for the first-login walkthrough to finish, so the two never stack.
  const [ready, setReady] = useState(tourDone);
  useEffect(() => {
    if (ready) return;
    const done = () => setReady(true);
    window.addEventListener(TOUR_DONE_EVENT, done);
    return () => window.removeEventListener(TOUR_DONE_EVENT, done);
  }, [ready]);
  const enroll = useMutation({
    mutationFn: enrollFaceId,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", "me"] });
      setScanning(false);
      toast.show("Face ID enrolled. You can now clock in for attendance with a face scan.");
    },
  });

  if (!ready || !me.data || me.data.faceEnrolled || later) return null;

  const remindLater = () => {
    try {
      localStorage.setItem(LATER_KEY, signInTime());
    } catch {
      // Not remembered; it shows again on the next page load.
    }
    setLater(true);
  };

  return (
    <>
      <Dialog
        open={!scanning}
        onClose={remindLater}
        title="Enroll your Face ID"
        dismissOnBackdrop={false}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={remindLater}>
              Remind me later
            </Button>
            <Button icon={<CameraIcon className="h-3.75 w-3.75" />} onClick={() => setScanning(true)}>
              Enroll Face ID now
            </Button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent-tint)] text-brand">
            <CameraIcon className="h-8 w-8" />
          </span>
          <div className="flex flex-col gap-2">
            <p className="text-[0.95rem] font-semibold">You need Face ID to record your attendance</p>
            <p className="text-sm text-ink-2">Clocking in and out uses a quick face scan. Enroll your face now so you're ready for your first day. It takes a few seconds with your camera.</p>
          </div>
        </div>
      </Dialog>
      <FaceScanDialog open={scanning} mode="enroll" onClose={() => setScanning(false)} onSuccess={() => enroll.mutate()} />
    </>
  );
}
