import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { ArrowRightIcon, CheckCircleIcon, InboxIcon } from "@/components/icons";
import { fetchOnboardingSubmissions } from "@/lib/api";
import type { OnboardingSubmission } from "@/lib/types";
import { formatSubmitted, submittedFileCount } from "./submissionFormat";

/**
 * Header icon on the Employee Directory: a count of Onboarding forms waiting for HR, and a panel
 * listing them. Review opens the accept dialog; only accepted people join the directory.
 * The panel renders at the top level of the page so page content can never paint over it.
 */
export function SubmissionsInbox({ onReview }: { onReview: (s: OnboardingSubmission) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const query = useQuery({ queryKey: ["admin", "onboarding-submissions"], queryFn: fetchOnboardingSubmissions });
  const waiting = query.data ?? [];

  // Pinned under the button; follows it on scroll and resize.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const r = buttonRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, right: Math.max(16, window.innerWidth - r.right) });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Keyboard users land inside the panel: on the first form to review, or the Pipeline link.
  useEffect(() => {
    if (open && pos) panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = waiting.length ? `Onboarding forms to review (${waiting.length})` : "Onboarding forms to review";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border bg-surface transition-colors hover:border-brand hover:text-ink ${open ? "border-brand text-ink" : "border-border text-ink-2"}`}
      >
        <InboxIcon className="h-4.5 w-4.5" />
        {waiting.length > 0 && (
          <span
            key={waiting.length}
            className="inbox-badge font-num absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-critical px-1 text-[0.65rem] font-bold text-white ring-2 ring-[var(--color-surface)]"
          >
            {waiting.length}
          </span>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Onboarding forms to review"
            style={{ top: pos.top, right: pos.right }}
            // Tabbing out of the panel closes it, like clicking elsewhere.
            onBlur={(e) => {
              const next = e.relatedTarget as Node | null;
              if (next && !panelRef.current?.contains(next) && !buttonRef.current?.contains(next)) setOpen(false);
            }}
            className="inbox-panel fixed z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_16px_48px_-12px_rgb(15_23_42/0.28)]"
          >
            <div className="flex items-start justify-between gap-3 px-4.5 pt-4 pb-3">
              <div>
                <p className="font-display text-[0.95rem] font-semibold tracking-[-0.01em]">Onboarding forms</p>
                <p className="mt-0.5 text-xs text-ink-2">Review each one and accept to add them to the directory.</p>
              </div>
              {waiting.length > 0 && (
                <span className="font-num flex-none rounded-full bg-brand-tint px-2 py-0.5 text-xs font-semibold text-brand-ink">{waiting.length} new</span>
              )}
            </div>

            {waiting.length === 0 ? (
              <div className="flex flex-col items-center gap-2 border-t border-border px-6 py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-good-tint text-good">
                  <CheckCircleIcon className="h-5.5 w-5.5" />
                </span>
                <p className="text-sm font-semibold">You're all caught up</p>
                <p className="max-w-[16rem] text-xs text-ink-2">New hires' forms land here as soon as they submit Onboarding.</p>
              </div>
            ) : (
              <ul className="max-h-80 overflow-y-auto border-t border-border p-1.5">
                {waiting.map((s, i) => (
                  <li key={s.id} className="inbox-row" style={{ animationDelay: `${60 + i * 40}ms` }}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onReview(s);
                      }}
                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <MiniAvatar initials={(s.input.firstName[0] ?? "") + (s.input.lastName[0] ?? "")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {s.input.firstName} {s.input.lastName}
                        </span>
                        <span className="block truncate text-xs text-ink-2">
                          Sent {formatSubmitted(s.submittedAt)} · {submittedFileCount(s)} file{submittedFileCount(s) === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="flex flex-none items-center gap-1 text-xs font-semibold text-brand-ink">
                        Review
                        <ArrowRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Link
              to="/admin/pipeline"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 border-t border-border bg-surface-2/60 px-4 py-2.5 text-xs font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              See everyone in Pipeline
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>,
          document.body,
        )}
    </>
  );
}
