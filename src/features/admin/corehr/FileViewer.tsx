import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { DownloadIcon, FileIcon } from "@/components/icons";
import { getFile } from "@/lib/fileStore";
import { formatDate } from "./format";

type Loaded = { url: string; type: string; name: string } | null;

/** Shows an uploaded document (PDF or image) inside the app, with a download button. */
export function FileViewer({ documentId, fileName, title, ownerName, uploadedAt, onClose }: { documentId: string; fileName: string; title: string; ownerName: string; uploadedAt?: string; onClose: () => void }) {
  const [file, setFile] = useState<Loaded | undefined>(undefined);

  useEffect(() => {
    let url = "";
    let alive = true;
    getFile(documentId).then((f) => {
      if (!alive) return;
      if (!f) return setFile(null);
      url = URL.createObjectURL(f.blob);
      setFile({ url, type: f.type || (/\.pdf$/i.test(f.name) ? "application/pdf" : "image/*"), name: f.name });
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [documentId]);

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title={`${title} · ${ownerName}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-ink-3">
            {fileName}
            {uploadedAt && ` · uploaded ${formatDate(uploadedAt)}`}
          </span>
          <span className="flex gap-2">
            {file && (
              <a href={file.url} download={file.name} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium hover:border-ink-3">
                <DownloadIcon className="h-4 w-4" /> Download
              </a>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </span>
        </div>
      }
    >
      <div className="flex h-[min(70dvh,40rem)] items-center justify-center overflow-hidden rounded-xl bg-surface-2">
        {file === undefined ? (
          <Skeleton className="h-full w-full" />
        ) : file === null ? (
          // Sample files from the demo data were never really uploaded, so there is nothing to show.
          <div className="flex max-w-sm flex-col items-center gap-3 p-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-ink-3">
              <FileIcon className="h-7 w-7" />
            </span>
            <p className="font-medium">No preview for this file</p>
            <p className="text-sm text-ink-2">This is sample data, so the actual file isn't stored. Files you upload now can be viewed here.</p>
          </div>
        ) : file.type.startsWith("image/") ? (
          <img src={file.url} alt={`${title} for ${ownerName}`} className="max-h-full max-w-full object-contain" />
        ) : (
          <iframe src={`${file.url}#view=FitH`} title={`${title} for ${ownerName}`} className="h-full w-full border-0 bg-white" />
        )}
      </div>
    </Dialog>
  );
}
