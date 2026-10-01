import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/** A form card whose lines draw in, with a pen (setup) or a check (live). Decorative. */
function FormArt({ done = false }: { done?: boolean }) {
  return (
    <svg viewBox="0 0 120 104" className="fp-art mx-auto h-28 w-32" aria-hidden="true">
      <ellipse cx="60" cy="96" rx="40" ry="5" className="fill-[var(--color-surface-2)]" />
      <g className="fp-card">
        <rect x="26" y="10" width="62" height="80" rx="10" className="fill-[var(--color-surface)] stroke-[var(--color-ink)]" strokeWidth="3" />
        <rect x="26" y="10" width="62" height="18" rx="10" className="fill-[var(--color-brand-tint)]" />
        <path d="M26 24h62" className="stroke-[var(--color-ink)]" strokeWidth="3" />
        {[40, 54, 68].map((y, i) => (
          <g key={y} style={{ "--fp-i": i } as React.CSSProperties}>
            <rect x="35" y={y - 4} width="8" height="8" rx="2.5" className="fp-box fill-[var(--color-brand)]" />
            <path d={`M49 ${y}h${i === 1 ? 22 : 30}`} className="fp-line stroke-[var(--color-ink-3)]" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        ))}
      </g>
      {done ? (
        <g className="fp-badge">
          <circle cx="88" cy="74" r="15" className="fill-[var(--color-good)] stroke-[var(--color-ink)]" strokeWidth="3" />
          <path d="M81 74.5l5 5 9-10" className="fp-check fill-none stroke-white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : (
        <g className="fp-pen">
          <path d="M80 70l18-18 7 7-18 18-9 2z" className="fill-[var(--color-brand)] stroke-[var(--color-ink)]" strokeWidth="3" strokeLinejoin="round" />
          <path d="M93 57l7 7" className="stroke-[var(--color-ink)]" strokeWidth="3" />
        </g>
      )}
    </svg>
  );
}

/** Opens on the Employee Directory while HR hasn't built the Onboarding form yet. */
export function FormSetupPrompt({ open, onStart, onLater }: { open: boolean; onStart: () => void; onLater: () => void }) {
  return (
    <Dialog open={open} onClose={onLater} title="Set up your onboarding form" size="prompt" dismissOnBackdrop={false}>
      <div className="text-center">
        <FormArt />
        <h2 className="font-display mt-3 text-lg font-semibold tracking-[-0.01em]">Set up your onboarding form</h2>
        <p className="mx-auto mt-1.5 max-w-[19rem] text-sm text-ink-2">
          Choose what new hires fill in when they join. You can change it anytime.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button variant="ghost" className="justify-center" onClick={onLater}>
            Not now
          </Button>
          <Button className="justify-center" onClick={onStart} data-autofocus>
            Start customizing form
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** After saving: the form is what new hires now see in Onboarding. */
export function FormLiveDialog({
  open,
  sectionCount,
  onEdit,
  onClose,
}: {
  open: boolean;
  sectionCount: number;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Your onboarding form is live" size="prompt">
      <div className="text-center">
        <FormArt done />
        <h2 className="font-display mt-3 text-lg font-semibold tracking-[-0.01em]">Your onboarding form is live</h2>
        <p className="mx-auto mt-1.5 max-w-[19rem] text-sm text-ink-2">
          New hires now see {sectionCount} {sectionCount === 1 ? "section" : "sections"}, then their government numbers and 201 files, when they open Onboarding.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <Button variant="ghost" className="justify-center" onClick={onEdit}>
            Edit form
          </Button>
          <Button className="justify-center" onClick={onClose} data-autofocus>
            Back to directory
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
