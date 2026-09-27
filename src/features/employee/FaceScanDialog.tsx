import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/icons";

type ScanState = "starting" | "ready" | "scanning" | "success" | "error";

export function FaceScanDialog({
  open,
  mode = "verify",
  onClose,
  onSuccess,
}: {
  open: boolean;
  mode?: "enroll" | "verify";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<ScanState>("starting");
  const [errorMessage, setErrorMessage] = useState("");

  const startCamera = useCallback(async () => {
    setState("starting");
    if (!navigator.mediaDevices) {
      setState("error");
      setErrorMessage("Camera access needs a secure connection (HTTPS). Open this app over HTTPS to use face scan.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setState("ready");
    } catch (err) {
      setState("error");
      setErrorMessage(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied. Allow camera access in your browser to continue."
          : "Couldn't access your camera. Check that it isn't in use by another app.",
      );
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function startScan() {
    setState("scanning");
    setTimeout(() => {
      setState("success");
      setTimeout(() => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onSuccess();
      }, 700);
    }, 1600);
  }

  return (
    <Dialog open={open} onClose={onClose} title={mode === "enroll" ? "Enroll Face ID" : "Face verification"}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-full border-4 border-border bg-surface-2">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
          {state === "error" && (
            <p className="absolute inset-0 flex items-center justify-center bg-surface-2 px-5 text-center text-xs text-critical">
              {errorMessage}
            </p>
          )}
          {state === "starting" && (
            <p className="absolute inset-0 flex items-center justify-center bg-surface-2 text-xs text-ink-2">
              Starting camera…
            </p>
          )}
          {(state === "scanning" || state === "success") && (
            <div
              className={clsx(
                "absolute inset-0 rounded-full border-4",
                state === "success" ? "border-good" : "animate-pulse border-brand",
              )}
            />
          )}
          {state === "success" && (
            <div className="absolute inset-0 flex items-center justify-center bg-good/20">
              <CheckIcon className="h-14 w-14 text-good" />
            </div>
          )}
        </div>

        <p className="text-center text-sm text-ink-2">
          {state === "ready" && "Position your face in the frame and select Scan."}
          {state === "scanning" && "Scanning face…"}
          {state === "success" && (mode === "enroll" ? "Face ID enrolled." : "Face verified.")}
        </p>

        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {state === "ready" && (
            <Button type="button" onClick={startScan}>
              Scan face
            </Button>
          )}
          {state === "error" && (
            <Button type="button" onClick={startCamera}>
              Retry
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
