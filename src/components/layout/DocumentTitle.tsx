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
  "/manager/workforce": "Workforce Intelligence",
  "/manager/performance": "Performance",
  "/manager/trainings": "Trainings",
  "/manager/cases": "Employee Relations",
  "/admin": "Overview",
  "/admin/directory": "Employee Directory",
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
