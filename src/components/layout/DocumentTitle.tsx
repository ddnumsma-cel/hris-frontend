import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/login": "Sign in",
  "/employee": "Home",
  "/employee/leave": "My leave",
  "/employee/attendance": "My attendance",
  "/employee/payslips": "Payslips",
  "/employee/201-file": "201 File",
  "/employee/certificates": "Certificates",
  "/employee/benefits": "HMO & Benefits",
  "/employee/trainings": "Trainings",
  "/manager": "Home",
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
  "/admin": "Home",
  "/admin/maintenance/people": "People",
  "/admin/maintenance/people/new": "Add employee",
  "/admin/maintenance/departments": "Departments",
  "/admin/maintenance/locations": "Locations",
  "/admin/maintenance/org-chart": "Org chart",
  "/admin/maintenance/documents": "Documents",
  "/admin/maintenance/leave/overview": "Leave",
  "/admin/maintenance/leave/requests": "Leave requests",
  "/admin/maintenance/leave/balances": "Leave balances",
  "/admin/maintenance/leave/types": "Leave types",
  "/admin/timekeeping/shifts": "Shifts",
  "/admin/timekeeping/schedules": "Schedules",
  "/admin/timekeeping/remote": "Remote work days",
  "/admin/maintenance/rules": "Rules",
  "/admin/requests": "Requests",
  "/admin/requests/reimbursement": "Reimbursements",
  "/admin/reports/attendance-logs": "Attendance logs",
  "/admin/reports/overtime": "Overtime",
  "/admin/reports/undertime": "Undertime",
  "/admin/reports/time-adjustments": "Time adjustments",
  "/admin/reports/tardiness": "Tardiness",
  "/admin/reports/hr": "HR reports",
  "/admin/reports/attendance": "Attendance reports",
  "/admin/reports/payroll": "Payroll reports",
  "/admin/payroll/contributions": "Government contributions",
  "/admin/payroll/runs": "Payroll runs",
  "/admin/reports/statutory": "Government reports",
  "/admin/reports/management": "Management reports",
  "/admin/onboarding/trainings": "Trainings",
  "/admin/administration/users": "Users",
  "/admin/administration/roles": "Roles & access",
  "/admin/administration/audit": "Audit trail",
  "/admin/administration/settings": "System settings",
  "/admin/administration/subscription": "Subscription & seats",
};

export function DocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    const label = titles[location.pathname] ?? (location.pathname.startsWith("/admin/maintenance/people/") ? "201 File" : undefined);
    document.title = label ? `${label} · MSMA` : "MSMA";
  }, [location.pathname]);

  return null;
}
