import { useLayoutEffect, useRef, type RefObject } from "react";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Moves elements inside `ref` from where they were to where they are now (FLIP), so reordering,
 * adding and removing slide instead of jumping. Elements are found by a data attribute holding a
 * stable key (`data-flip-key` by default). Positions are measured against `originOf(el)` (the root
 * by default), so scrolling — or a parent that moves on its own — doesn't count as movement.
 */
export function useFlip(
  ref: RefObject<HTMLElement | null>,
  { attr = "flipKey", originOf }: { attr?: string; originOf?: (el: HTMLElement) => Element | null } = {},
) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = new Map<string, number>();
    const motion = !prefersReducedMotion();
    const selector = `[data-${attr.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}]`;
    for (const el of root.querySelectorAll<HTMLElement>(selector)) {
      const key = el.dataset[attr]!;
      const origin = (originOf?.(el) ?? root).getBoundingClientRect().top;
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
