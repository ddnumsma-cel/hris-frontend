import { useState } from "react";

const STORAGE_KEY = "sidebar-collapsed";

/** Saved choice, or the default: expanded on desktop (≥ 1024px), collapsed on smaller screens. */
function initialCollapsed() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "true" || saved === "false") return saved === "true";
  } catch {
    // Storage blocked: fall back to the screen-size default.
  }
  return typeof window !== "undefined" && window.innerWidth < 1024;
}

/**
 * The desktop sidebar's collapsed (icon rail) / expanded (drawer) state. Read synchronously on
 * first render so the saved state shows without a flash. Toggling marks <body> for a moment so
 * index.css animates the change; the first render never animates.
 */
export function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const set = (next: boolean) => {
    document.body.dataset.sidebarAnim = "";
    window.setTimeout(() => delete document.body.dataset.sidebarAnim, 700);
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Not remembered after reload; still applies now.
    }
  };
  return [collapsed, set];
}
