// Request types shown under Requests. Each type is one entry here, so adding a new kind of
// request (cash advance, equipment, …) means adding a line and its page, not a new module.

import type { Feature } from "../permissions";

export interface RequestType {
  /** Used in the URL: /admin/requests/reimbursement */
  id: string;
  label: string;
  description: string;
  /** The access-matrix row that decides who can see and act on this type (lib/permissions.ts). */
  feature: Feature;
}

export const REQUEST_TYPES: RequestType[] = [
  { id: "reimbursement", label: "Reimbursements", description: "Expense claims with their receipts.", feature: "claims" },
];

export const requestTypeById = (id: string | null) => REQUEST_TYPES.find((t) => t.id === id);
