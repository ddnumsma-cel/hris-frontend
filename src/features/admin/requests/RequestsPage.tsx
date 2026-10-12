// Requests: every kind of employee request, one page per type (/admin/requests/:type). The types
// come from lib/requests/types.ts and are listed in the sidebar under Requests ›; each one renders
// its own page, which carries the heading.

import type { ComponentType } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { ContentHead } from "@/components/layout/RolePage";
import { REQUEST_TYPES, requestTypeById } from "@/lib/requests/types";
import { can } from "@/lib/permissions";
import { useWho } from "@/lib/useCan";
import { ReimbursementsPage } from "../reimbursements/ReimbursementsPage";
import { CertificatesPage } from "./CertificatesPage";

/** The page for each request type. */
const PAGES: Record<string, ComponentType> = {
  reimbursement: ReimbursementsPage,
  certificates: CertificatesPage,
};

export function RequestsPage() {
  const who = useWho();
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
  return Page ? <Page /> : <ContentHead title="Requests" subtitle={type ? type.description : "No request types to show."} />;
}
