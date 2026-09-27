import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import {
  fetchAdminOverviewStats,
  fetchApprovalsQueue,
  fetchComplianceCalendar,
  fetchCurrentEmployee,
  fetchEmployeeDtrSummary,
  fetchLeaveBalances,
  fetchPayslips,
  fetchTeamRoster,
  fetchWorkforceAlerts,
} from "@/lib/api";
import { getEffectiveCompliance } from "@/lib/automation";
import type {
  AdminOverviewStats,
  DtrSummary,
  Employee,
  LeaveBalance,
  LeaveRequest,
  Payslip,
  TeamRosterMember,
  WorkforceAlert,
} from "@/lib/types";

export interface AssistantData {
  isReady: boolean;
  role?: "employee" | "manager" | "admin";
  userName?: string;
  employee?: Employee;
  balances?: LeaveBalance[];
  latestPayslip?: Payslip;
  dtr?: DtrSummary;
  roster?: TeamRosterMember[];
  approvals?: LeaveRequest[];
  alerts?: WorkforceAlert[];
  stats?: AdminOverviewStats;
  complianceOverdueCount?: number;
  complianceDueSoonCount?: number;
}

export function useAssistantData(): AssistantData {
  const { user } = useAuth();
  const role = user?.role;

  const employeeQuery = useQuery({
    queryKey: ["employee", "me"],
    queryFn: fetchCurrentEmployee,
    enabled: role === "employee",
  });
  const balancesQuery = useQuery({
    queryKey: ["employee", "leave-balances"],
    queryFn: fetchLeaveBalances,
    enabled: role === "employee",
  });
  const payslipsQuery = useQuery({
    queryKey: ["employee", "payslips"],
    queryFn: fetchPayslips,
    enabled: role === "employee",
  });
  const dtrQuery = useQuery({
    queryKey: ["employee", "dtr"],
    queryFn: fetchEmployeeDtrSummary,
    enabled: role === "employee",
  });

  const rosterQuery = useQuery({
    queryKey: ["manager", "team-roster"],
    queryFn: fetchTeamRoster,
    enabled: role === "manager",
  });
  const approvalsQuery = useQuery({
    queryKey: ["approvals-queue"],
    queryFn: fetchApprovalsQueue,
    enabled: role === "manager",
  });
  const workforceAlertsQuery = useQuery({
    queryKey: ["manager", "workforce-alerts"],
    queryFn: fetchWorkforceAlerts,
    enabled: role === "manager",
  });

  const statsQuery = useQuery({
    queryKey: ["admin", "overview-stats"],
    queryFn: fetchAdminOverviewStats,
    enabled: role === "admin",
  });
  const complianceQuery = useQuery({
    queryKey: ["admin", "compliance-calendar"],
    queryFn: fetchComplianceCalendar,
    enabled: role === "admin",
  });

  if (!user) return { isReady: false };

  const effectiveCompliance = (complianceQuery.data ?? []).map((item) => getEffectiveCompliance(item));

  return {
    isReady: true,
    role: user.role,
    userName: user.name,
    employee: employeeQuery.data,
    balances: balancesQuery.data,
    latestPayslip: payslipsQuery.data?.[0],
    dtr: dtrQuery.data,
    roster: rosterQuery.data,
    approvals: approvalsQuery.data,
    alerts: workforceAlertsQuery.data,
    stats: statsQuery.data,
    complianceOverdueCount: effectiveCompliance.filter((c) => c.status === "Overdue").length,
    complianceDueSoonCount: effectiveCompliance.filter((c) => c.status === "Due soon").length,
  };
}
