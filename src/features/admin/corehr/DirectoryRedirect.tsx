import { Navigate, useSearchParams } from "react-router-dom";

/** Older links point at /admin/directory (the Overview's buttons, ?employee=, ?q=). */
export function DirectoryRedirect() {
  const [params] = useSearchParams();
  const employee = params.get("employee");
  const q = params.get("q");
  return <Navigate replace to={employee ? `/admin/people/${employee}` : `/admin/people${q ? `?q=${encodeURIComponent(q)}` : ""}`} />;
}
