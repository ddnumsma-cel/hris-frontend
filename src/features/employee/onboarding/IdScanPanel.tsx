import { useRef, useState, type DragEvent } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { AlertTriangleIcon, CameraIcon, CheckCircleIcon, IdCardIcon, LoaderIcon, PlusIcon, UploadIcon, XIcon } from "@/components/icons";
import { imageLabels, listFields, MAX_ID_IMAGES, type IdScan } from "./useIdScan";

export function IdScanPanel({ idScan }: { idScan: IdScan }) {
  const { images, scan, addFiles, removeImage, scanning } = idScan;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!scanning) addFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={clsx(
        "rounded-xl border border-dashed p-4 transition-colors",
        dragging ? "border-brand bg-brand-tint" : "border-border bg-surface-2/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        {images.length === 0 ? (
          <div className="flex min-w-0 flex-1 basis-full items-start gap-3 sm:basis-auto">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-surface text-ink-2 ring-1 ring-border">
              <IdCardIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Save typing: upload a valid ID</p>
              <p className="text-xs text-ink-2">PhilSys, UMID, driver's license, passport or PRC. Drop a photo here, or browse.</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-1 items-center gap-2" aria-label="Uploaded ID images">
            {images.map((img, i) => (
              <li key={img.url} className="relative">
                <img src={img.url} alt={`Uploaded ${imageLabels[i]}`} className="h-11 w-16 rounded-md border border-border object-cover" />
                {!scanning && (
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label={`Remove ${imageLabels[i]}`}
                    className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-ink-2 shadow-sm hover:text-critical"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {images.length < MAX_ID_IMAGES && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={images.length === 0 ? <UploadIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
            onClick={() => inputRef.current?.click()}
            disabled={scanning}
          >
            {images.length === 0 ? "Upload ID photo" : "Add back of ID or another ID"}
          </Button>
        )}
      </div>

      <div aria-live="polite">
        {scan.status === "scanning" && (
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
            <LoaderIcon className="h-3.5 w-3.5 flex-none animate-spin" />
            <span className="flex-none">
              {scan.side && `${scan.side}: `}
              {scan.progress.stage}…
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-brand transition-[width]"
                style={{ width: `${Math.max(8, Math.round(scan.progress.progress * 100))}%` }}
              />
            </div>
          </div>
        )}
        {scan.status === "done" && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-2">
            <CheckCircleIcon className="mt-px h-3.5 w-3.5 flex-none text-good" />
            <span>
              <span className="font-semibold text-ink">
                {scan.filled.length > 0 ? `Filled ${scan.filled.length} field${scan.filled.length === 1 ? "" : "s"}` : "Nothing new to fill"}
                {scan.source === "qr" ? " from the QR code" : scan.idTypes.length > 0 && ` from the ${scan.idTypes.join(" and ")}`}.
              </span>{" "}
              Check the fields tagged "From ID". The photo is saved to the 201 file.
              {scan.unsure.length > 0 && ` Couldn't make out the ${listFields(scan.unsure)} — type ${scan.unsure.length === 1 ? "it" : "them"} in.`}
            </span>
          </p>
        )}
        {scan.status === "done" && scan.mismatched.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangleIcon className="mt-px h-3.5 w-3.5 flex-none" />
            <span>
              Skipped an ID for {scan.mismatched.map((m) => `"${m.lastName}"`).join(", ")} — the surname doesn't match this employee.
            </span>
          </p>
        )}
        {scan.status === "retake" && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md bg-critical-tint px-3 py-2 text-xs">
            <CameraIcon className="h-3.5 w-3.5 flex-none text-critical" />
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-critical">{scan.title}.</span> <span className="text-ink">{scan.reason}</span>
            </span>
            <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
              Retake photo
            </Button>
          </div>
        )}
        {scan.status === "error" && <p className="mt-3 text-xs font-semibold text-critical">{scan.message}</p>}
      </div>
    </div>
  );
}
