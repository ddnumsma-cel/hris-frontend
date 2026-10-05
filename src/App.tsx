import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { ProtectedRoute, RootRedirect } from "@/components/layout/ProtectedRoute";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { DocumentTitle } from "@/components/layout/DocumentTitle";
import { NotFoundPage } from "@/components/layout/NotFoundPage";
import { PageLoadingFallback } from "@/components/layout/PageLoadingFallback";
import { useAuth } from "@/features/auth/AuthContext";
import { hasHrAccess } from "@/lib/admin/auth";
import { LoginPage } from "@/features/auth/LoginPage";
import { OfficeFilterProvider } from "@/features/admin/OfficeFilterContext";
import { FirstLoginTour } from "@/components/shared/FirstLoginTour";

const AssistantWidget = lazy(() =>
  import("@/features/assistant/AssistantWidget").then((m) => ({ default: m.AssistantWidget })),
);

const ManagerReportPage = lazy(() =>
  import("@/features/manager/reports/ManagerReportPage").then((m) => ({ default: m.ManagerReportPage })),
);
const AdminLayout = lazy(() => import("@/features/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const AdminOverview = lazy(() => import("@/features/admin/AdminOverview").then((m) => ({ default: m.AdminOverview })));
const PeoplePage = lazy(() => import("@/features/admin/corehr/PeoplePage").then((m) => ({ default: m.PeoplePage })));
const EmployeePage = lazy(() => import("@/features/admin/corehr/EmployeePage").then((m) => ({ default: m.EmployeePage })));
const NewEmployeePage = lazy(() => import("@/features/admin/corehr/NewEmployeePage").then((m) => ({ default: m.NewEmployeePage })));
const ShiftsPage = lazy(() => import("@/features/admin/timekeeping/ShiftsPage").then((m) => ({ default: m.ShiftsPage })));
const SchedulesPage = lazy(() => import("@/features/admin/timekeeping/SchedulesPage").then((m) => ({ default: m.SchedulesPage })));
const AttendanceLogsPage = lazy(() => import("@/features/admin/timekeeping/AttendanceLogsPage").then((m) => ({ default: m.AttendanceLogsPage })));
const OvertimePage = lazy(() => import("@/features/admin/timekeeping/RequestsPage").then((m) => ({ default: m.OvertimePage })));
const UndertimePage = lazy(() => import("@/features/admin/timekeeping/RequestsPage").then((m) => ({ default: m.UndertimePage })));
const LeaveOverviewPage = lazy(() => import("@/features/admin/leave/LeaveOverviewPage").then((m) => ({ default: m.LeaveOverviewPage })));
const LeaveRequestsPage = lazy(() => import("@/features/admin/leave/LeaveRequestsPage").then((m) => ({ default: m.LeaveRequestsPage })));
const BalancesPage = lazy(() => import("@/features/admin/leave/BalancesPage").then((m) => ({ default: m.BalancesPage })));
const LeaveTypesPage = lazy(() => import("@/features/admin/leave/LeaveTypesPage").then((m) => ({ default: m.LeaveTypesPage })));
const ReportsDashboard = lazy(() => import("@/features/admin/reports/ReportsDashboard").then((m) => ({ default: m.ReportsDashboard })));
const HrReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.HrReportsPage })));
const AttendanceReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.AttendanceReportsPage })));
const PayrollReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.PayrollReportsPage })));
const StatutoryReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.StatutoryReportsPage })));
const ManagementReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.ManagementReportsPage })));
const UsersPage = lazy(() => import("@/features/admin/administration/UsersPage").then((m) => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import("@/features/admin/administration/RolesPage").then((m) => ({ default: m.RolesPage })));
const WorkflowsPage = lazy(() => import("@/features/admin/administration/WorkflowsPage").then((m) => ({ default: m.WorkflowsPage })));
const AuditTrailPage = lazy(() => import("@/features/admin/administration/AuditTrailPage").then((m) => ({ default: m.AuditTrailPage })));
const SystemSettingsPage = lazy(() => import("@/features/admin/administration/SystemSettingsPage").then((m) => ({ default: m.SystemSettingsPage })));
const TardinessPage = lazy(() => import("@/features/admin/timekeeping/TardinessPage").then((m) => ({ default: m.TardinessPage })));
const CompanyPage = lazy(() => import("@/features/admin/corehr/CompanyPage").then((m) => ({ default: m.CompanyPage })));
const DocumentsPage = lazy(() => import("@/features/admin/corehr/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const DirectoryRedirect = lazy(() =>
  import("@/features/admin/corehr/DirectoryRedirect").then((m) => ({ default: m.DirectoryRedirect })),
);

const EmployeeLayout = lazy(() =>
  import("@/features/employee/EmployeeLayout").then((m) => ({ default: m.EmployeeLayout })),
);
const EmployeeOverview = lazy(() =>
  import("@/features/employee/EmployeeOverview").then((m) => ({ default: m.EmployeeOverview })),
);
const EmployeeLeaveDtr = lazy(() =>
  import("@/features/employee/EmployeeLeaveDtr").then((m) => ({ default: m.EmployeeLeaveDtr })),
);
const EmployeePayslips = lazy(() =>
  import("@/features/employee/EmployeePayslips").then((m) => ({ default: m.EmployeePayslips })),
);
const Employee201File = lazy(() =>
  import("@/features/employee/Employee201File").then((m) => ({ default: m.Employee201File })),
);
const EmployeeCertificates = lazy(() =>
  import("@/features/employee/EmployeeCertificates").then((m) => ({ default: m.EmployeeCertificates })),
);
const EmployeeBenefitsPage = lazy(() =>
  import("@/features/employee/EmployeeBenefitsPage").then((m) => ({ default: m.EmployeeBenefitsPage })),
);
const EmployeeTrainings = lazy(() =>
  import("@/features/employee/EmployeeTrainings").then((m) => ({ default: m.EmployeeTrainings })),
);

const ManagerLayout = lazy(() => import("@/features/manager/ManagerLayout").then((m) => ({ default: m.ManagerLayout })));
const ManagerOverview = lazy(() =>
  import("@/features/manager/ManagerOverview").then((m) => ({ default: m.ManagerOverview })),
);
const ManagerApprovals = lazy(() =>
  import("@/features/manager/ManagerApprovals").then((m) => ({ default: m.ManagerApprovals })),
);
const ManagerCalendar = lazy(() =>
  import("@/features/manager/ManagerCalendar").then((m) => ({ default: m.ManagerCalendar })),
);
const ManagerAttendancePage = lazy(() =>
  import("@/features/manager/ManagerAttendancePage").then((m) => ({ default: m.ManagerAttendancePage })),
);
const ManagerWorkforcePage = lazy(() =>
  import("@/features/manager/ManagerWorkforcePage").then((m) => ({ default: m.ManagerWorkforcePage })),
);
const ManagerPerformance = lazy(() =>
  import("@/features/manager/ManagerPerformance").then((m) => ({ default: m.ManagerPerformance })),
);
const ManagerTrainings = lazy(() =>
  import("@/features/manager/ManagerTrainings").then((m) => ({ default: m.ManagerTrainings })),
);
const ManagerAttendanceApprovals = lazy(() =>
  import("@/features/manager/ManagerAttendanceApprovals").then((m) => ({ default: m.ManagerAttendanceApprovals })),
);
const ManagerPayroll = lazy(() => import("@/features/manager/ManagerPayroll").then((m) => ({ default: m.ManagerPayroll })));
const ManagerSettings = lazy(() =>
  import("@/features/manager/ManagerSettings").then((m) => ({ default: m.ManagerSettings })),
);
const ManagerCases = lazy(() => import("@/features/manager/ManagerCases").then((m) => ({ default: m.ManagerCases })));

function App() {
  const { user } = useAuth();

  return (
    <OfficeFilterProvider>
      <div className="min-h-screen text-ink" data-role={user?.role}>
        <div className="app-background" aria-hidden="true" />
        <ScrollToTop />
        <DocumentTitle />
        <TopBar />
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<RootRedirect />} />

            <Route
              path="/employee"
              element={
                <ProtectedRoute role="employee">
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<EmployeeOverview />} />
              <Route path="leave-dtr" element={<EmployeeLeaveDtr />} />
              <Route path="payslips" element={<EmployeePayslips />} />
              <Route path="201-file" element={<Employee201File />} />
              <Route path="certificates" element={<EmployeeCertificates />} />
              <Route path="benefits" element={<EmployeeBenefitsPage />} />
              <Route path="trainings" element={<EmployeeTrainings />} />
            </Route>

            <Route
              path="/manager"
              element={
                <ProtectedRoute role="manager">
                  <ManagerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ManagerOverview />} />
              <Route path="approvals" element={<ManagerApprovals />} />
              <Route path="calendar" element={<ManagerCalendar />} />
              <Route path="attendance" element={<ManagerAttendancePage />} />
              <Route path="attendance-approvals" element={<ManagerAttendanceApprovals />} />
              <Route path="workforce" element={<ManagerWorkforcePage />} />
              <Route path="performance" element={<ManagerPerformance />} />
              <Route path="trainings" element={<ManagerTrainings />} />
              <Route path="cases" element={<ManagerCases />} />
              <Route path="payroll" element={<ManagerPayroll />} />
              <Route path="reports" element={<Navigate to="/manager/reports/overtime" replace />} />
              <Route path="reports/:reportId" element={<ManagerReportPage />} />
              <Route path="settings" element={<ManagerSettings />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminOverview />} />
              <Route path="people" element={<PeoplePage />} />
              <Route path="people/new" element={<NewEmployeePage />} />
              <Route path="people/:employeeId" element={<EmployeePage />} />
              <Route path="company" element={<CompanyPage />} />
              <Route path="timekeeping" element={<Navigate to="/admin/timekeeping/logs" replace />} />
              <Route path="timekeeping/shifts" element={<ShiftsPage />} />
              <Route path="timekeeping/schedules" element={<SchedulesPage />} />
              <Route path="timekeeping/logs" element={<AttendanceLogsPage />} />
              <Route path="timekeeping/overtime" element={<OvertimePage />} />
              <Route path="timekeeping/undertime" element={<UndertimePage />} />
              <Route path="timekeeping/tardiness" element={<TardinessPage />} />
              <Route path="leave" element={<Navigate to="/admin/leave/overview" replace />} />
              <Route path="leave/overview" element={<LeaveOverviewPage />} />
              <Route path="leave/requests" element={<LeaveRequestsPage />} />
              <Route path="leave/balances" element={<BalancesPage />} />
              <Route path="leave/types" element={<LeaveTypesPage />} />
              <Route path="reports" element={<Navigate to="/admin/reports/dashboard" replace />} />
              <Route path="reports/dashboard" element={<ReportsDashboard />} />
              <Route path="reports/hr" element={<HrReportsPage />} />
              <Route path="reports/attendance" element={<AttendanceReportsPage />} />
              <Route path="reports/payroll" element={<PayrollReportsPage />} />
              <Route path="reports/statutory" element={<StatutoryReportsPage />} />
              <Route path="reports/management" element={<ManagementReportsPage />} />
              <Route path="administration" element={<Navigate to="/admin/administration/users" replace />} />
              <Route path="administration/users" element={<UsersPage />} />
              <Route path="administration/roles" element={<RolesPage />} />
              <Route path="administration/workflows" element={<WorkflowsPage />} />
              <Route path="administration/audit" element={<AuditTrailPage />} />
              <Route path="administration/settings" element={<SystemSettingsPage />} />
              <Route path="organization" element={<Navigate to="/admin/company" replace />} />
              <Route path="positions" element={<Navigate to="/admin/company" replace />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="directory" element={<DirectoryRedirect />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>

        {/* The HR assistant answers from employee data, so system-only accounts don't get it. */}
        {user && (user.role !== "admin" || hasHrAccess(user.accountId)) && (
          <Suspense fallback={null}>
            <AssistantWidget />
          </Suspense>
        )}
        {user && <FirstLoginTour />}
      </div>
    </OfficeFilterProvider>
  );
}

export default App;
