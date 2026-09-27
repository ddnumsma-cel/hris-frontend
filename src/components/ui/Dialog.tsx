import { useEffect, type ReactNode } from "react";
import { XIcon } from "../icons";

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="overlay-enter fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20 sm:pt-28"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="panel-enter w-full max-w-md rounded-xl border border-border bg-surface shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border px-4.5 py-3.5">
          <h2 className="font-display text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4.5">{children}</div>
      </div>
    </div>
  );
}
