import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/login": "Sign in",
  "/employee": "Overview",
  "/employee/leave": "My leave",
  "/employee/attendance": "My attendance",
  "/employee/payslips": "Payslips",
  "/employee/201-file": "201 File",
  "/employee/certificates": "Certificates",
  "/employee/benefits": "HMO & Benefits",
  "/employee/trainings": "Trainings",
  "/manager": "Overview",
  "/manager/approvals": "Approvals",
  "/manager/calendar": "Team Calendar",
  "/manager/attendance": "Attendance",
  "/manager/attendance-approvals": "Attendance Approvals",
  "/manager/payroll": "Payroll",
  "/manager/settings": "Settings",
  "/manager/workforce": "Workforce Intelligence",
  "/manager/performance": "Performance",
  "/manager/trainings": "Trainings",
  "/manager/cases": "Employee Relations",
  "/manager/reports/overtime": "Overtime Report",
  "/manager/reports/leave": "Leave Report",
  "/manager/reports/locator-slip": "Locator Slip Report",
  "/manager/reports/timesheet": "Timesheet Report",
  "/manager/reports/temporary-shift": "Temporary Shift Report",
  "/manager/reports/broken-time": "Broken Time Report",
  "/manager/reports/offset-hours": "Offset Hours Report",
  "/admin": "Overview",
  "/admin/people": "People",
  "/admin/people/new": "Add employee",
  "/admin/org-chart": "Org chart",
  "/admin/timekeeping/shifts": "Shifts",
  "/admin/timekeeping/schedules": "Schedules",
  "/admin/timekeeping/logs": "Attendance logs",
  "/admin/timekeeping/overtime": "Overtime",
  "/admin/timekeeping/undertime": "Undertime",
  "/admin/timekeeping/tardiness": "Tardiness",
  "/admin/timekeeping/corrections": "Time adjustments",
  "/admin/timekeeping/remote": "Remote work days",
  "/admin/leave/overview": "Leave",
  "/admin/leave/requests": "Leave requests",
  "/admin/leave/balances": "Leave balances",
  "/admin/leave/types": "Leave types",
  "/admin/reports/hr": "HR reports",
  "/admin/reports/attendance": "Attendance reports",
  "/admin/reports/payroll": "Payroll reports",
  "/admin/payroll/contributions": "Government contributions",
  "/admin/payroll/runs": "Payroll runs",
  "/admin/reports/statutory": "Government reports",
  "/admin/reports/management": "Management reports",
  "/admin/administration/users": "Users",
  "/admin/administration/roles": "Roles & access",
  "/admin/administration/workflows": "Approval workflows",
  "/admin/administration/audit": "Audit trail",
  "/admin/administration/settings": "System settings",
  "/admin/documents": "Documents",
};

export function DocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    const label = titles[location.pathname] ?? (location.pathname.startsWith("/admin/people/") ? "201 File" : undefined);
    document.title = label ? `${label} · MSMA` : "MSMA";
  }, [location.pathname]);

  return null;
}
