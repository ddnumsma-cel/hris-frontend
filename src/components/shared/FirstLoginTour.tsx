import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "msma-hris-tour-seen";

interface TourStep {
  target: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    target: "sidenav",
    title: "Your navigation",
    body: "Everything for your role — leave, payslips, approvals, and more — lives here.",
  },
  {
    target: "attention-panel",
    title: "Needs your attention",
    body: "Anything that needs a decision or is coming due gets flagged here automatically, so you don't need to go looking for it.",
  },
  {
    target: "assistant-button",
    title: "Ask the assistant",
    body: "Tap here anytime to ask about your leave balance, payslips, or team — it reads real data already in this system.",
  },
];

/**
 * A one-time, dismissible walkthrough shown on a user's first login. Targets
 * are found by data-tour attribute rather than refs so it works across all
 * three role layouts without those layouts knowing the tour exists. A target
 * that isn't in the DOM (e.g. sidenav is hidden on mobile) is skipped rather
 * than blocking the tour.
 */
export function FirstLoginTour() {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!user) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    setStepIndex(0);
  }, [user]);

  useEffect(() => {
    if (stepIndex === null) return;
    if (stepIndex >= STEPS.length) {
      finish();
      return;
    }

    // Layouts/routes are lazy-loaded, so the target may not exist in the DOM
    // yet right after login — poll briefly instead of giving up on the first
    // tick, and only treat it as genuinely absent (e.g. sidenav on mobile)
    // after a couple of seconds.
    const target = STEPS[stepIndex].target;
    let cancelled = false;
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    function tryFind() {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (el) {
        setRect(el.getBoundingClientRect());
        return;
      }
      attempts += 1;
      if (attempts > 15) {
        setStepIndex((i) => (i === null ? null : i + 1));
        return;
      }
      timeoutId = setTimeout(tryFind, 200);
    }
    tryFind();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [stepIndex]);

  function finish() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private browsing / storage disabled — just stop showing it this session */
    }
    setStepIndex(null);
    setRect(null);
  }

  function next() {
    setStepIndex((i) => (i === null ? null : i + 1));
  }

  if (stepIndex === null || stepIndex >= STEPS.length || !rect) return null;
  const step = STEPS[stepIndex];

  const cardWidth = 300;
  const cardHeight = 150;
  const fitsBelow = rect.bottom + cardHeight + 12 <= window.innerHeight;
  const top = fitsBelow ? rect.bottom + 12 : Math.max(16, rect.top - cardHeight - 12);
  const left = Math.min(Math.max(rect.left, 16), window.innerWidth - cardWidth - 16);

  return (
    <>
      <button
        type="button"
        aria-label="Skip walkthrough"
        onClick={finish}
        className="fixed inset-0 z-95 bg-black/30"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed z-96 rounded-lg ring-2 ring-brand-ink"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          boxShadow: "0 0 0 4px color-mix(in srgb, var(--color-brand) 35%, transparent)",
        }}
      />
      <div
        className="panel-enter fixed z-96 rounded-2xl border border-border bg-surface p-4 shadow-lg"
        style={{ top, left, width: cardWidth }}
      >
        <div className="text-sm font-bold">{step.title}</div>
        <p className="mt-1.5 text-xs text-ink-2">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={finish} className="text-xs font-semibold text-ink-3">
            Skip
          </button>
          <div className="flex items-center gap-2.5">
            <span className="text-[0.68rem] text-ink-3">
              {stepIndex + 1}/{STEPS.length}
            </span>
            <Button size="sm" onClick={next}>
              {stepIndex + 1 === STEPS.length ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
