// Payroll on the backend: the website still works the pay out (lib/pay/engine.ts, MSMA's workbook rules), from the
// backend's people and attendance; the backend keeps each run, locks it on approval and writes the payslips.
// Employees are keyed by employee number, as everywhere in the backend adapters.

import type { Adjustment } from "../pay/engine";
import type { PayrollRun } from "../pay/runs";
import type { PayLine } from "../reports/api";
import { api } from "./client";

/** Who is on payroll, shaped like the people lib/reports/api.ts works pay out for. */
export interface PayrollPerson {
  id: string;
  name: string;
  position: string;
  department: string;
  branch: string;
  type: string;
  status: string;
  hired: string;
  separated?: string;
  salary: number;
  sex: string;
  sssNo: string;
  philhealthNo: string;
  pagibigNo: string;
  tin: string;
}

type Pay = { lines: PayLine[]; auto: Record<string, Adjustment[]> };

export const backendPayrollPeople = () => api<PayrollPerson[]>("/payroll/people");
export const backendListRuns = () => api<PayrollRun[]>("/payroll/runs");
export const backendGetRun = (id: string) => api<PayrollRun>(`/payroll/runs/${encodeURIComponent(id)}`);
export const backendCreateRun = (run: { label: string; from: string; to: string; adjustments: Record<string, Adjustment[]> } & Pay) =>
  api<PayrollRun>("/payroll/runs", { method: "POST", body: run });
export const backendUpdateRun = (id: string, body: { adjustments: Record<string, Adjustment[]> } & Pay) =>
  api<PayrollRun>(`/payroll/runs/${encodeURIComponent(id)}`, { method: "PUT", body });
export const backendReviewRun = (id: string) => api<PayrollRun>(`/payroll/runs/${encodeURIComponent(id)}/review`, { method: "POST" });
export const backendApproveRun = (id: string, body: Pay) => api<PayrollRun>(`/payroll/runs/${encodeURIComponent(id)}/approve`, { method: "POST", body });
export const backendDeleteRun = (id: string) => api<void>(`/payroll/runs/${encodeURIComponent(id)}`, { method: "DELETE" });
