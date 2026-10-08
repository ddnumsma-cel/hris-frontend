import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * Redirect for a page that moved, so old links and bookmarks keep working. `:params` in `to`
 * are filled from the old URL, and the old query string and #hash are kept (merged with any
 * query in `to`).
 */
export function Moved({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const [path, query = ""] = to.replace(/:(\w+)/g, (_, k: string) => encodeURIComponent(params[k] ?? "")).split("?");
  const merged = new URLSearchParams(query);
  new URLSearchParams(search).forEach((v, k) => merged.set(k, v));
  const qs = merged.toString();
  return <Navigate to={`${path}${qs ? `?${qs}` : ""}${hash}`} replace />;
}
