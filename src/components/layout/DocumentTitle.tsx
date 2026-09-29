import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/login": "Sign in",
  "/employee": "Overview",
  "/employee/leave-dtr": "Leave & DTR",
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
  "/admin/directory": "Employee Directory",
  "/admin/201-files": "201 Files",
  "/admin/settings": "Settings",
  "/admin/org-chart": "Org Chart",
  "/admin/onboarding": "Onboarding",
  "/admin/offboarding": "Offboarding",
  "/admin/assets": "Company Assets",
  "/admin/trainings": "Training & Development",
  "/admin/cases": "Employee Relations",
  "/admin/certificates": "Certificate Requests",
  "/admin/payroll-runs": "Payroll Runs",
  "/admin/compliance": "Compliance",
  "/admin/reports": "Reports",
};

export function DocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    const label = titles[location.pathname];
    document.title = label ? `${label} · MSMA` : "MSMA";
  }, [location.pathname]);

  return null;
}
