import { useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";
import { XIcon } from "../icons";

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
const FOCUSABLE_FIRST = ":is(input, select, textarea, button, a[href])";

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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      // Keep Tab inside the dialog while it's open.
      if (e.key === "Tab" && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("disabled"));
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Move focus into the dialog when it opens, and back to where it was when it closes.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const target = panel.querySelector<HTMLElement>("[autofocus], [data-autofocus]") ?? panel.querySelector<HTMLElement>(`[data-dialog-body] ${FOCUSABLE_FIRST}`);
      (target ?? panel).focus();
    }
    return () => previous?.focus?.();
  }, [open]);

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
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "panel-enter w-full rounded-xl border border-border bg-surface shadow-lg outline-none",
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
        <div data-dialog-body className={clsx("p-4.5", large && "min-h-0 flex-1 overflow-y-auto")}>
          {children}
        </div>
        {footer && <div className="flex-none border-t border-border px-4.5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
