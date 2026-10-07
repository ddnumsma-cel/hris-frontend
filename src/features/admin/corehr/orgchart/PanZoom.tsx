import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { MinusIcon, PlusIcon } from "@/components/icons";

const MIN = 0.3;
const MAX = 2;

/** A drawing board: drag to move, buttons to zoom and fit. Children are laid out at width × height. */
export function PanZoom({ width, height, children, footer }: { width: number; height: number; children: ReactNode; footer?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const k = Math.max(MIN, Math.min(1.1, (el.clientWidth - 48) / width, (el.clientHeight - 48) / height));
    setView({ k, x: (el.clientWidth - width * k) / 2, y: (el.clientHeight - height * k) / 2 });
  }, [width, height]);
  useLayoutEffect(fit, [fit]);

  const zoom = (factor: number) => {
    const el = box.current;
    if (!el) return;
    setView((v) => {
      const k = Math.min(MAX, Math.max(MIN, v.k * factor));
      // Keep the middle of the board where it is.
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
  };
  const up = () => (drag.current = null);

  const control = "flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink";
  return (
    <div
      ref={box}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="relative h-[min(640px,75vh)] cursor-grab touch-none overflow-hidden rounded-2xl border border-border bg-surface active:cursor-grabbing"
      style={{ backgroundImage: "radial-gradient(var(--color-border) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
    >
      <div className="absolute top-0 left-0 origin-top-left" style={{ width, height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        {children}
      </div>
      <div className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-xl border border-border bg-surface p-1 shadow-sm">
        <button type="button" aria-label="Zoom out" onClick={() => zoom(1 / 1.2)} className={control}>
          <MinusIcon className="h-4 w-4" />
        </button>
        <span className="font-num w-11 text-center text-xs text-ink-2">{Math.round(view.k * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1.2)} className={control}>
          <PlusIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={fit} className="h-9 rounded-lg px-2.5 text-xs font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
          Fit
        </button>
      </div>
      {footer && <div className="absolute bottom-3 left-3">{footer}</div>}
    </div>
  );
}
