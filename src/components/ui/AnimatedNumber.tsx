import { useEffect, useRef, useState } from "react";

const DURATION_MS = 700;

// "₱314,669", "41%", "126 days", "4.2%" → prefix, number, suffix.
const NUMBER_PATTERN = /^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/;

function parse(text: string) {
  const match = NUMBER_PATTERN.exec(text);
  if (!match) return null;
  const [, prefix, digits, suffix] = match;
  const value = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const decimals = digits.includes(".") ? digits.split(".")[1].length : 0;
  return { prefix, suffix, value, decimals, grouped: digits.includes(",") || Math.abs(value) >= 10_000 };
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts up to a figure the first time it appears, and from the old figure to the new one when it
 * changes (e.g. "Waiting for HR" going 3 → 2 after an approval), so the change is noticed.
 * Anything that isn't a single number is shown as-is.
 */
export function AnimatedNumber({ value }: { value: string | number }) {
  const text = String(value);
  const parsed = parse(text);
  const target = parsed?.value ?? 0;
  const [shown, setShown] = useState(() => (parsed && !prefersReducedMotion() ? 0 : target));
  const fromRef = useRef(shown);

  useEffect(() => {
    if (!parsed) return;
    if (prefersReducedMotion()) {
      fromRef.current = target;
      setShown(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const next = from + (target - from) * easeOutCubic(t);
      fromRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // Re-run only when the figure itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!parsed) return <>{text}</>;

  const formatted = shown.toLocaleString("en-PH", {
    minimumFractionDigits: parsed.decimals,
    maximumFractionDigits: parsed.decimals,
    useGrouping: parsed.grouped,
  });

  return (
    <>
      <span aria-hidden="true">
        {parsed.prefix}
        {formatted}
        {parsed.suffix}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}
