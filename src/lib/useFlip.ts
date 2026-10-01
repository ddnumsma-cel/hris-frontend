import { useLayoutEffect, useRef, type RefObject } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Moves elements marked `data-flip-key` inside `ref` from where they were to where they are now
 * (FLIP), so reordering, adding and removing slide instead of jumping. Measured against `ref`
 * itself, so scrolling between renders doesn't count as movement.
 */
export function useFlip(ref: RefObject<HTMLElement | null>) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = new Map<string, number>();
    const motion = !prefersReducedMotion();
    const origin = root.getBoundingClientRect().top;
    for (const el of root.querySelectorAll<HTMLElement>("[data-flip-key]")) {
      const key = el.dataset.flipKey!;
      const top = el.getBoundingClientRect().top - origin;
      next.set(key, top);
      const before = last.current.get(key);
      if (motion && before !== undefined && Math.abs(before - top) > 1) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], {
          duration: 220,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    }
    last.current = next;
  });
}
