import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Opens a page's "create" form when the URL asks for it with ?create=<id> (the sidebar's
 * Create menu links here), then drops the parameter so a refresh doesn't reopen it.
 */
export function useCreateParam(id: string, open: () => void) {
  const [params, setParams] = useSearchParams();
  const wanted = params.get("create") === id;
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!wanted) return;
    openRef.current();
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("create");
        return next;
      },
      { replace: true },
    );
  }, [wanted, setParams]);
}
