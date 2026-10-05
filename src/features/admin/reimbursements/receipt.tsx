import { Dialog } from "@/components/ui/Dialog";

/** Small receipt preview that opens the full photo. */
export function ReceiptThumb({ src, onOpen, label }: { src: string; onOpen: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View receipt: ${label}`}
      className="group relative h-11 w-9 flex-none overflow-hidden rounded-md border border-border bg-surface-2 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-brand"
    >
      <img src={src} alt="" className="h-full w-full object-cover object-top" />
    </button>
  );
}

export function ReceiptViewer({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  return (
    <Dialog open size="lg" onClose={onClose} title={title}>
      <div className="flex justify-center rounded-lg bg-surface-2 p-3">
        <img src={src} alt={`Receipt: ${title}`} className="max-h-[70vh] w-auto max-w-full rounded-md object-contain shadow-sm" />
      </div>
    </Dialog>
  );
}
