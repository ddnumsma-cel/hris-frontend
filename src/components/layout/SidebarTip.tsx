import { useState, type FocusEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";

/**
 * Tooltips for the collapsed sidebar: any element inside it with data-tip="Label" shows the
 * label beside the rail on hover or keyboard focus. Drawn in a portal because the sidebar
 * clips its overflow. Returns the handlers to spread on the sidebar and the tooltip element.
 */
export function useSidebarTips(enabled: boolean) {
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);

  const show = (e: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>) => {
    const el = enabled ? (e.target as HTMLElement).closest<HTMLElement>("[data-tip]") : null;
    if (!el?.dataset.tip) return setTip(null);
    const r = el.getBoundingClientRect();
    setTip({ label: el.dataset.tip, top: r.top + r.height / 2 });
  };
  const hide = () => setTip(null);

  const handlers = { onMouseOver: show, onFocus: show, onMouseLeave: hide, onBlur: hide };
  const element =
    enabled && tip
      ? createPortal(
          <div
            role="tooltip"
            style={{ top: tip.top, left: "calc(var(--sidenav-w) + 8px)" }}
            className="pointer-events-none fixed z-[60] -translate-y-1/2 rounded-[var(--radius-control)] bg-brand-dark px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-[var(--shadow-panel)]"
          >
            {tip.label}
          </div>,
          document.body,
        )
      : null;
  return { handlers, element };
}
