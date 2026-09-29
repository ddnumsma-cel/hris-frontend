import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import { XIcon } from "../icons";

export function Dialog({
  open,
  onClose,
  title,
  size = "md",
  header,
  footer,
  dismissOnBackdrop = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "md" | "lg";
  /** Pinned below the title bar; stays visible while the body scrolls. */
  header?: ReactNode;
  /** Pinned at the bottom; stays visible while the body scrolls. */
  footer?: ReactNode;
  /** Set false for forms where a stray click outside shouldn't throw away input. */
  dismissOnBackdrop?: boolean;
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

  const large = size === "lg";

  return (
    <div
      className={clsx(
        "overlay-enter fixed inset-0 z-50 flex justify-center bg-black/40 p-4",
        large ? "items-center" : "items-start overflow-y-auto pt-20 sm:pt-28",
      )}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "panel-enter w-full rounded-xl border border-border bg-surface shadow-lg",
          large ? "flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col overflow-hidden" : "max-w-md",
        )}
      >
        <div className="flex flex-none items-center justify-between border-b border-border px-4.5 py-3.5">
          <h2 className="font-display text-base font-semibold tracking-[-0.01em]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {header && <div className="flex-none border-b border-border px-4.5 pt-4">{header}</div>}
        <div className={clsx("p-4.5", large && "min-h-0 flex-1 overflow-y-auto")}>{children}</div>
        {footer && <div className="flex-none border-t border-border px-4.5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
