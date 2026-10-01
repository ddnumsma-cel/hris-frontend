import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MiniAvatar } from "@/components/ui/MiniAvatar";
import { InboxIcon } from "@/components/icons";
import { fetchOnboardingSubmissions } from "@/lib/api";
import type { OnboardingSubmission } from "@/lib/types";
import { formatSubmitted, submittedFileCount } from "./submissionFormat";

/**
 * Header icon on the Employee Directory: a count of Onboarding forms waiting for HR, and a panel
 * listing them. Review opens the accept dialog; only accepted people join the directory.
 */
export function SubmissionsInbox({ onReview }: { onReview: (s: OnboardingSubmission) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const query = useQuery({ queryKey: ["admin", "onboarding-submissions"], queryFn: fetchOnboardingSubmissions });
  const waiting = query.data ?? [];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-2 transition-colors hover:border-brand hover:text-ink"
      >
        <InboxIcon className="h-4.5 w-4.5" />
        {waiting.length > 0 && (
          <span key={waiting.length} className="inbox-badge font-num absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-critical px-1 text-[0.65rem] font-bold text-white ring-2 ring-[var(--color-surface)]">
            {waiting.length}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Onboarding forms to review" className="panel-enter absolute top-11 right-0 z-30 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Onboarding forms</p>
            <p className="text-xs text-ink-2">
              {waiting.length ? `${waiting.length} waiting for you to review and accept` : "Nothing waiting. New forms show up here."}
            </p>
          </div>
          {waiting.length > 0 && (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {waiting.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <MiniAvatar initials={(s.input.firstName[0] ?? "") + (s.input.lastName[0] ?? "")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {s.input.firstName} {s.input.lastName}
                    </p>
                    <p className="truncate text-xs text-ink-3">
                      {formatSubmitted(s.submittedAt)} · {submittedFileCount(s)} file{submittedFileCount(s) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onReview(s);
                    }}
                    className="flex-none rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-ink"
                  >
                    Review
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/pipeline" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-brand-ink hover:bg-surface-2">
            Open Pipeline
          </Link>
        </div>
      )}
    </div>
  );
}
