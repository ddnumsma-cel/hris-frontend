import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "ghost" | "danger" | "remove";
type Size = "md" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /**
   * The work this button started is running (e.g. `mutation.isPending`). Passing it, even as
   * false, turns on the loading morph: the button shrinks into a circle with bouncing dots while
   * loading, shows a green check when it finishes with `succeeded`, then returns to its label.
   */
  loading?: boolean;
  /** The work succeeded (e.g. `mutation.isSuccess`); read when `loading` turns false. */
  succeeded?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "btn-primary font-semibold",
  ghost: "btn-secondary font-medium",
  danger: "btn-danger font-semibold",
  remove: "btn-remove font-medium",
};

const sizeClasses: Record<Size, string> = {
  md: "px-4 py-2 text-[13px]",
  sm: "px-3 py-1.5 text-xs",
};

const DONE_MS = 1400;
/** The morph into the circle takes 560ms; quick answers wait for it, so the steps never skip. */
const MIN_LOADING_MS = 600;

/** idle → loading → done (only when it succeeded) → idle, following `loading` / `succeeded`. For a
 *  hand-built button: put it in `.btn-morph`, set data-phase, wrap its content in `.btn-label`
 *  and add <MorphLayers /> inside it and <MorphAnnouncement phase={…} /> after it (see RegisterDialog). */
export function useMorph(loading: boolean | undefined, succeeded: boolean | undefined, button: React.RefObject<HTMLButtonElement | null>) {
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const startedAt = useRef(0);
  // Read when loading ends; not a dependency, so a later change can't cancel the pending step.
  const ok = useRef(succeeded);
  ok.current = succeeded;
  useEffect(() => {
    if (loading === undefined) return;
    if (loading) {
      // The circle is as wide as the button is tall: clip half the difference from each side.
      const r = button.current?.getBoundingClientRect();
      if (r) button.current!.style.setProperty("--morph-x", `${Math.max(0, r.width / 2 - r.height / 2)}px`);
      startedAt.current = performance.now();
      setPhase("loading");
      return;
    }
    if (!startedAt.current) return;
    const wait = Math.max(0, MIN_LOADING_MS - (performance.now() - startedAt.current));
    startedAt.current = 0;
    let t = window.setTimeout(() => {
      if (!ok.current) return setPhase("idle");
      setPhase("done");
      t = window.setTimeout(() => setPhase("idle"), DONE_MS);
    }, wait);
    return () => clearTimeout(t);
  }, [loading, button]);
  return phase;
}

/** The dots, the check and the announcement a loading button needs (inside the button, the live region after it). */
export function MorphLayers() {
  return (
    <>
      <span className="btn-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="btn-done" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path pathLength={1} d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    </>
  );
}

export const MorphAnnouncement = ({ phase }: { phase: string }) => (
  <span aria-live="polite" className="sr-only">
    {phase === "done" ? "Done." : ""}
  </span>
);

export function Button({ variant = "primary", size = "md", icon, children, className, loading, succeeded, ...rest }: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const phase = useMorph(loading, succeeded, ref);
  const classes = clsx("btn inline-flex items-center gap-1.5 whitespace-nowrap", variantClasses[variant], sizeClasses[size]);

  if (loading === undefined)
    return (
      <button data-variant={variant} className={clsx(classes, className)} {...rest}>
        {icon}
        {children}
      </button>
    );

  // Layout classes go on the wrapper, which also carries the shadow of the clipped shape.
  return (
    <span className={clsx("btn-morph", className)}>
      <button ref={ref} data-variant={variant} data-phase={phase} aria-busy={phase === "loading" || undefined} className={classes} {...rest}>
        <span className="btn-label">
          {icon}
          {children}
        </span>
        <MorphLayers />
      </button>
      <MorphAnnouncement phase={phase} />
    </span>
  );
}
