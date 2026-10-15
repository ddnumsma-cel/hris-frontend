import { useLayoutEffect } from "react";

// Keeps the top of every page in view while its content scrolls: the page heading (ContentHead)
// and the rows of tabs, search and filters right under it stay pinned below the top bar, and a
// table's column headers pin under them. Works from the page's own markup, so every page gets it
// without changes:
// - the pinned run starts at the page's ContentHead (a direct child marked data-page-head) or a
//   row marked data-page-top, and takes the rows right after it that are tabs, short rows of
//   controls (search, selects, view switches) or a one-line caption, up to the first content;
// - pages inside a page (Settings' areas, pages embedded in Settings) pin the same way, under
//   the rows already pinned by the page around them;
// - nothing is pinned on phones, or when the pinned rows would take too much of the window;
// - a table's header pins only when the table fits its box; a table that has to scroll sideways
//   keeps its normal header rather than being clipped.

const MAX_ROW = 96; // px: taller rows are content, not a toolbar
const MAX_CAPTION = 24; // px: a one-line description under the heading
const MAX_SHARE = 0.4; // of the window height
const MAX_LEAD = 64; // px: the most space kept between the top bar and a pinned heading
const MIN_WIDTH = 640; // px: below this (phones) nothing pins
const CONTENT = "table, article, img, textarea";
// Where a page sits inside another page and gets its own pinned run.
const NESTED = "[data-page-root], .settings-embed";

const isControlRow = (el: HTMLElement) =>
  el.matches("[data-page-top], [role='tablist']") ||
  (el.offsetHeight <= MAX_ROW && (el.matches("input, select") || !!el.querySelector("input, select, [role='tablist'], [role='group']")) && !el.querySelector(CONTENT)) ||
  (el.offsetHeight <= MAX_CAPTION && !el.querySelector(`${CONTENT}, button, a`));

const isStart = (el: HTMLElement) => el.matches("[data-page-head], [data-page-top]");

/**
 * `body` is the page area itself (from a callback ref, not a ref object): while a page's code loads,
 * Suspense shows a placeholder instead, so the area only appears later; passing the element makes
 * this run again the moment it does.
 */
export function useStickyPageTop(body: HTMLElement | null, key: string) {
  useLayoutEffect(() => {
    if (!body) return;
    let frame = 0;

    // The top bar's height in px (it's a CSS variable the top bar keeps up to date).
    const topbarHeight = () => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;height:var(--topbar-h, 0px)";
      document.body.appendChild(probe);
      const px = probe.offsetHeight;
      probe.remove();
      return px;
    };

    // Pins the run at the top of one page (body or a nested page) below `base` px of rows already
    // pinned around it; returns how far the run reaches, or null when nothing was pinned. With no
    // rows pinned around it, the run pins right where it already sits on the page, so nothing
    // moves when the page starts to scroll.
    const pin = (root: HTMLElement, around: number | null, topbar: number) => {
      const flow = (Array.from(root.children) as HTMLElement[]).filter((k) => getComputedStyle(k).position !== "fixed");
      if (!flow[0] || !isStart(flow[0])) return null;
      const resting = flow[0].getBoundingClientRect().top + window.scrollY - topbar;
      const base = around ?? (resting >= 0 && resting <= MAX_LEAD ? resting : 0);
      const run = [flow[0]];
      for (const k of flow.slice(1)) {
        if (!isControlRow(k)) break;
        run.push(k);
      }
      const gap = parseFloat(getComputedStyle(root).rowGap) || 0;
      // Exact (fractional) heights, so no hairline of content shows between the pinned rows.
      const h = (k: HTMLElement) => k.getBoundingClientRect().height;
      const height = run.reduce((n, k) => n + h(k) + gap, 0);
      if (base + height > window.innerHeight * MAX_SHARE) return null;
      let offset = base;
      for (const k of run) {
        k.classList.add("page-top");
        k.style.top = `calc(var(--topbar-h, 0px) + ${offset}px)`;
        offset += h(k) + gap;
      }
      root.style.setProperty("--page-top-h", `${offset}px`);
      root.style.setProperty("--page-top-gap", `${gap}px`);
      root.style.setProperty("--page-top-lead", `${base}px`);
      // The first row with nothing pinned above it also covers the space up to the top bar.
      if (around === null) run[0].setAttribute("data-page-top-first", "");
      return offset;
    };

    const sync = () => {
      body.querySelectorAll<HTMLElement>(".page-top").forEach((k) => {
        k.classList.remove("page-top");
        k.removeAttribute("data-page-top-first");
        k.style.removeProperty("top");
      });
      const roots = [body, ...Array.from(body.querySelectorAll<HTMLElement>(NESTED))];
      roots.forEach((r) => {
        r.style.removeProperty("--page-top-h");
        r.style.removeProperty("--page-top-gap");
        r.style.removeProperty("--page-top-lead");
      });
      body.querySelectorAll<HTMLElement>("[data-sticky-clip]").forEach((el) => {
        el.removeAttribute("data-sticky-clip");
        el.removeAttribute("data-sticky-card");
        el.style.removeProperty("--sticky-card-r");
      });
      body.querySelectorAll<HTMLElement>("table[data-sticky-head]").forEach((el) => {
        el.removeAttribute("data-sticky-head");
        el.removeAttribute("data-sticky-cap");
        for (const v of ["--sticky-head-inset", "--sticky-cap-r", "--sticky-cap-w", "--sticky-cap-line"]) el.style.removeProperty(v);
      });
      if (window.innerWidth < MIN_WIDTH) return;

      // Outer pages first, so a nested page pins under what its parents pinned.
      const topbar = topbarHeight();
      const reach = new Map<HTMLElement, number>();
      for (const root of roots) {
        let around: number | null = null;
        for (let el = root.parentElement; el && body.contains(el); el = el.parentElement) {
          if (reach.has(el)) {
            around = reach.get(el)!;
            break;
          }
        }
        const end = pin(root, around, topbar);
        if (end !== null) reach.set(root, end);
      }
      if (!body.querySelector(".page-top")) return;

      // Column headers of page-level tables that fit their box (no sideways scrolling needed).
      for (const table of Array.from(body.querySelectorAll<HTMLTableElement>("table"))) {
        if (table.closest("[role='dialog'], .page-top")) continue;
        const box = table.parentElement;
        if (!box || table.scrollWidth > box.clientWidth + 1) continue;
        // Pin it as far inside its block (the card's border, a caption) as it sits when resting, so
        // it doesn't shift when it catches.
        const root: HTMLElement = table.parentElement?.closest<HTMLElement>(NESTED) ?? body;
        let block: HTMLElement = table;
        while (block.parentElement && block.parentElement !== root && root.contains(block.parentElement)) block = block.parentElement;
        const head = table.tHead ?? table;
        table.style.setProperty("--sticky-head-inset", `${Math.max(0, head.getBoundingClientRect().top - block.getBoundingClientRect().top)}px`);
        table.setAttribute("data-sticky-head", "");
        // When the header row is the top of a rounded card, the pinned header draws that card top
        // (border and corners) itself, since the card's own top scrolls away under it.
        let card: HTMLElement | null = null;
        for (let el: HTMLElement | null = table.parentElement; el && el !== root; el = el.parentElement) {
          const s = getComputedStyle(el);
          const line = parseFloat(s.borderTopWidth) || 0;
          if (!line && !(parseFloat(s.borderTopLeftRadius) > 0)) continue;
          if (Math.abs(head.getBoundingClientRect().top - el.getBoundingClientRect().top - line) <= 0.5) {
            card = el;
            table.setAttribute("data-sticky-cap", "");
            table.style.setProperty("--sticky-cap-r", s.borderTopLeftRadius);
            table.style.setProperty("--sticky-cap-w", `${line}px`);
            table.style.setProperty("--sticky-cap-line", s.borderTopColor);
          }
          break;
        }
        // Boxes that clip or scroll would trap the sticky header; clip without scrolling instead.
        // Inside a capped card nothing may clip the header's corners where they cover the card's
        // border, so those boxes stay open and the card keeps only its rounded bottom clipped.
        for (let el: HTMLElement | null = table.parentElement; el && el !== body; el = el.parentElement) {
          const s = getComputedStyle(el);
          if (s.overflowX === "visible" && s.overflowY === "visible") continue;
          const open = !!card && card.contains(el);
          el.setAttribute("data-sticky-clip", open ? "open" : "");
          if (el === card) {
            el.setAttribute("data-sticky-card", "");
            el.style.setProperty("--sticky-card-r", s.borderBottomLeftRadius);
          }
        }
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    schedule();
    const resize = new ResizeObserver(schedule);
    resize.observe(body);
    const mutate = new MutationObserver(schedule);
    mutate.observe(body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutate.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [body, key]);
}
