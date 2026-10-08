import type { Role } from "@/lib/types";

/** Pages someone can choose to open after signing in ("" = the workspace Home). */
export const LANDING_OPTIONS: Record<Role, { value: string; label: string }[]> = {
  admin: [
    { value: "", label: "Home" },
    { value: "/admin/maintenance/people", label: "People" },
    { value: "/admin/reports/attendance-logs", label: "Attendance logs" },
    { value: "/admin/maintenance/leave/requests", label: "Leave requests" },
    { value: "/admin/payroll/runs", label: "Payroll runs" },
    { value: "/admin/reports/hr", label: "HR reports" },
  ],
  manager: [
    { value: "", label: "Home" },
    { value: "/manager/approvals", label: "Approvals" },
    { value: "/manager/calendar", label: "Team calendar" },
    { value: "/manager/attendance", label: "Team attendance" },
    { value: "/manager/payroll", label: "Payroll" },
  ],
  employee: [
    { value: "", label: "Home" },
    { value: "/employee/leave", label: "My leave" },
    { value: "/employee/attendance", label: "My attendance" },
    { value: "/employee/payslips", label: "Payslips" },
    { value: "/employee/201-file", label: "201 File" },
  ],
};

/** Where to go after signing in: the saved landing page if it belongs to this workspace, else Home. */
export function landingPath(role: Role, saved: string | undefined) {
  return saved && saved.startsWith(`/${role}/`) ? saved : `/${role}`;
}
