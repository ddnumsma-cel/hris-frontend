import { useEffect, useState, type RefObject } from "react";

// Space kept under the table for the pagination bar and the gap above it.
const PAGINATION_RESERVE = 56;
const FALLBACK_ROW_HEIGHT = 57;
const MIN_ROWS = 3;

/**
 * Picks how many table rows fit between the table card's top edge and the bottom
 * of the window, so a paged desktop table never makes the page scroll. Capped at
 * `maxRows`. Pass something that changes when the rows first render (e.g. the
 * query's loading flag) as `remeasureKey` so real row heights get measured.
 */
export function useRowsThatFit(cardRef: RefObject<HTMLElement | null>, maxRows: number, remeasureKey?: unknown) {
  const [rows, setRows] = useState(maxRows);

  useEffect(() => {
    function measure() {
      const card = cardRef.current;
      // Phones (or a table hidden in favour of a card list) scroll normally instead.
      const isDesktop = window.matchMedia("(min-width: 640px)").matches;
      if (!card || !isDesktop || card.offsetParent === null) return setRows(maxRows);
      const main = card.closest("main");
      const mainPaddingBottom = main ? parseFloat(getComputedStyle(main).paddingBottom) : 0;
      const headHeight = card.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const rowHeight = card.querySelector("tbody tr")?.getBoundingClientRect().height || FALLBACK_ROW_HEIGHT;
      const top = card.getBoundingClientRect().top + window.scrollY;
      const available = window.innerHeight - top - headHeight - mainPaddingBottom - PAGINATION_RESERVE;
      setRows(Math.min(maxRows, Math.max(MIN_ROWS, Math.floor(available / rowHeight))));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [cardRef, maxRows, remeasureKey]);

  return rows;
}
