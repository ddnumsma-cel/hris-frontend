import { useEffect, useRef } from "react";

/**
 * A card that tilts toward the pointer in 3D, eased so it feels weighted, with a soft glare that
 * follows the pointer (--mx / --my, see .tilt-card in index.css). Measures against the card's
 * parent, which doesn't tilt, so the pointer position never jitters. Touch is ignored (a finger
 * scrolling never tilts it), `still` holds it flat (e.g. while its menu is open), and reduced
 * motion turns it off. Only transform is animated.
 */
export function useTilt<T extends HTMLElement>(still = false) {
  const ref = useRef<T>(null);
  const flatten = useRef<() => void>(() => {});
  const held = useRef(still);
  held.current = still;

  useEffect(() => {
    const el = ref.current;
    const area = el?.parentElement;
    if (!el || !area || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let target = { x: 0, y: 0, s: 1 };
    const now = { x: 0, y: 0, s: 1 };
    let raf = 0;
    const tick = () => {
      now.x += (target.x - now.x) * 0.12;
      now.y += (target.y - now.y) * 0.12;
      now.s += (target.s - now.s) * 0.12;
      el.style.transform = `perspective(700px) rotateY(${now.x}deg) rotateX(${now.y}deg) scale(${now.s})`;
      const settled = Math.abs(target.x - now.x) + Math.abs(target.y - now.y) + Math.abs(target.s - now.s) < 0.05;
      if (!settled) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        // At rest, no transform at all, so the card's menu and focus ring behave normally.
        if (target.x === 0 && target.y === 0 && target.s === 1) el.style.transform = "";
      }
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch" || held.current) return;
      const r = area.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      target = { x: (x - 0.5) * 24, y: (0.5 - y) * 20, s: 1.02 };
      el.style.setProperty("--mx", `${x * 100}%`);
      el.style.setProperty("--my", `${y * 100}%`);
      kick();
    };
    const leave = () => {
      target = { x: 0, y: 0, s: 1 };
      kick();
    };
    flatten.current = leave;
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerleave", leave);
      el.style.transform = "";
    };
  }, []);

  useEffect(() => {
    if (still) flatten.current();
  }, [still]);

  return ref;
}
