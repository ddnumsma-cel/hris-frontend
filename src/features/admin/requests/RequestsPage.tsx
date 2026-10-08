// Requests: every kind of employee request, one page per type (/admin/requests/:type). The types
// come from lib/requests/types.ts; each one renders its existing page underneath.

import type { ComponentType } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { REQUEST_TYPES, requestTypeById } from "@/lib/requests/types";
import { can } from "@/lib/permissions";
import { useWho } from "@/lib/useCan";
import { ReimbursementsPage } from "../reimbursements/ReimbursementsPage";
import { Choice, Toolbar } from "../timekeeping/common";

/** The page for each request type. */
const PAGES: Record<string, ComponentType> = {
  reimbursement: ReimbursementsPage,
};

export function RequestsPage() {
  const who = useWho();
  const navigate = useNavigate();
  const { type: typeId } = useParams();
  const [params] = useSearchParams();
  const types = REQUEST_TYPES.filter((t) => can(who, "view", t.feature));
  // /admin/requests (or the older ?type=…) opens the first type they can see.
  if (!typeId) {
    const first = requestTypeById(params.get("type")) ?? types[0];
    return first ? <Navigate to={`/admin/requests/${first.id}`} replace /> : <ContentHead title="Requests" subtitle="No request types to show." />;
  }
  const type = requestTypeById(typeId);
  const Page = type ? PAGES[type.id] : undefined;

  return (
    <>
      <ContentHead title="Requests" subtitle={type ? type.description : "No request types to show."} />
      {types.length > 1 && (
        <Toolbar>
          <Choice label="Request type" value={type?.id ?? ""} onChange={(id) => navigate(`/admin/requests/${id}`)} options={types.map((t) => ({ value: t.id, label: t.label }))} />
        </Toolbar>
      )}
      {Page && (
        <div className="settings-embed flex min-w-0 flex-col gap-5">
          <Page />
        </div>
      )}
    </>
  );
}
