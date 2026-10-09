import { lazy, Suspense, useLayoutEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { ProtectedRoute, RootRedirect } from "@/components/layout/ProtectedRoute";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { DocumentTitle } from "@/components/layout/DocumentTitle";
import { NotFoundPage } from "@/components/layout/NotFoundPage";
import { Moved } from "@/components/layout/Moved";
import { PageLoadingFallback } from "@/components/layout/PageLoadingFallback";
import { useAuth } from "@/features/auth/AuthContext";
import { hasHrAccess } from "@/lib/admin/auth";
import { SignInWelcome } from "@/features/auth/SignInWelcome";
import { LoginPage } from "@/features/auth/LoginPage";
import { OfficeFilterProvider } from "@/features/admin/OfficeFilterContext";
import { FirstLoginTour } from "@/components/shared/FirstLoginTour";
import { applyAccountPrefs, applyAppearance, resetPreferences, usePreferencesVersion } from "@/lib/preferences";
import { settingsFor, settingsKeyFor } from "@/lib/settings/store";

const AssistantWidget = lazy(() =>
  import("@/features/assistant/AssistantWidget").then((m) => ({ default: m.AssistantWidget })),
);

const ManagerReportPage = lazy(() =>
  import("@/features/manager/reports/ManagerReportPage").then((m) => ({ default: m.ManagerReportPage })),
);
const AdminLayout = lazy(() => import("@/features/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
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
const LeaveReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.LeaveReportsPage })));
const HrReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.HrReportsPage })));
const AttendanceReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.AttendanceReportsPage })));
const LoansPage = lazy(() => import("@/features/admin/payroll/LoansPage").then((m) => ({ default: m.LoansPage })));
const FinalPayPage = lazy(() => import("@/features/admin/payroll/FinalPayPage").then((m) => ({ default: m.FinalPayPage })));
const PayoutsPage = lazy(() => import("@/features/admin/payroll/PayoutsPage").then((m) => ({ default: m.PayoutsPage })));
const YearEndPage = lazy(() => import("@/features/admin/payroll/YearEndPage").then((m) => ({ default: m.YearEndPage })));
const AdminHome = lazy(() => import("@/features/admin/payroll/AccountingHome").then((m) => ({ default: m.AdminHome })));
const PayDetailsPage = lazy(() => import("@/features/admin/payroll/PayDetailsPage").then((m) => ({ default: m.PayDetailsPage })));
const PayrollRunsPage = lazy(() => import("@/features/admin/payroll/PayrollRunsPage").then((m) => ({ default: m.PayrollRunsPage })));
const PayrollRunPage = lazy(() => import("@/features/admin/payroll/PayrollRunsPage").then((m) => ({ default: m.PayrollRunPage })));
const ContributionsPage = lazy(() => import("@/features/admin/payroll/ContributionsPage").then((m) => ({ default: m.ContributionsPage })));
const PayrollReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.PayrollReportsPage })));
const StatutoryReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.StatutoryReportsPage })));
const ManagementReportsPage = lazy(() => import("@/features/admin/reports/ReportPage").then((m) => ({ default: m.ManagementReportsPage })));
const UsersPage = lazy(() => import("@/features/admin/administration/UsersPage").then((m) => ({ default: m.UsersPage })));
const OutboxPage = lazy(() => import("@/features/admin/administration/OutboxPage").then((m) => ({ default: m.OutboxPage })));
const SubscriptionPage = lazy(() => import("@/features/admin/administration/SubscriptionPage").then((m) => ({ default: m.SubscriptionPage })));
const RolesPage = lazy(() => import("@/features/admin/administration/RolesPage").then((m) => ({ default: m.RolesPage })));
const AuditTrailPage = lazy(() => import("@/features/admin/administration/AuditTrailPage").then((m) => ({ default: m.AuditTrailPage })));
const SystemSettingsPage = lazy(() => import("@/features/admin/administration/SystemSettingsPage").then((m) => ({ default: m.SystemSettingsPage })));
const RemoteDaysPage = lazy(() => import("@/features/admin/timekeeping/RemoteDaysPage").then((m) => ({ default: m.RemoteDaysPage })));
const HolidayCalendarPage = lazy(() => import("@/features/admin/timekeeping/HolidayCalendarPage").then((m) => ({ default: m.HolidayCalendarPage })));
const CorrectionsPage = lazy(() => import("@/features/admin/timekeeping/CorrectionsPage").then((m) => ({ default: m.CorrectionsPage })));
const OrgChartPage = lazy(() => import("@/features/admin/corehr/OrgChartPage").then((m) => ({ default: m.OrgChartPage })));
const TardinessPage = lazy(() => import("@/features/admin/timekeeping/TardinessPage").then((m) => ({ default: m.TardinessPage })));
const DocumentsPage = lazy(() => import("@/features/admin/corehr/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const DepartmentsPage = lazy(() => import("@/features/admin/maintenance/DepartmentsPage").then((m) => ({ default: m.DepartmentsPage })));
const LocationsPage = lazy(() => import("@/features/admin/maintenance/LocationsPage").then((m) => ({ default: m.LocationsPage })));
const RulesPage = lazy(() => import("@/features/admin/maintenance/RulesPage").then((m) => ({ default: m.RulesPage })));
const RequestsPage = lazy(() => import("@/features/admin/requests/RequestsPage").then((m) => ({ default: m.RequestsPage })));
const TrainingsPage = lazy(() => import("@/features/admin/onboarding/TrainingsPage").then((m) => ({ default: m.TrainingsPage })));
const DirectoryRedirect = lazy(() =>
  import("@/features/admin/corehr/DirectoryRedirect").then((m) => ({ default: m.DirectoryRedirect })),
);

const EmployeeLayout = lazy(() =>
  import("@/features/employee/EmployeeLayout").then((m) => ({ default: m.EmployeeLayout })),
);
const EmployeeOverview = lazy(() =>
  import("@/features/employee/EmployeeOverview").then((m) => ({ default: m.EmployeeOverview })),
);
const EmployeeLeave = lazy(() =>
  import("@/features/employee/EmployeeLeave").then((m) => ({ default: m.EmployeeLeave })),
);
const EmployeeAttendance = lazy(() =>
  import("@/features/employee/EmployeeAttendance").then((m) => ({ default: m.EmployeeAttendance })),
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
const EmployeeReimbursements = lazy(() =>
  import("@/features/employee/EmployeeReimbursements").then((m) => ({ default: m.EmployeeReimbursements })),
);
const EmployeePolicies = lazy(() => import("@/features/employee/EmployeePolicies").then((m) => ({ default: m.EmployeePolicies })));
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
const ManagerPayroll = lazy(() => import("@/features/manager/ManagerPayroll").then((m) => ({ default: m.ManagerPayroll })));
// Settings (every workspace): /{role}/settings/..., with /settings/... redirecting there.
const SettingsLayout = lazy(() => import("@/features/settings/SettingsLayout").then((m) => ({ default: m.SettingsLayout })));
const SettingsRedirect = lazy(() => import("@/features/settings/SettingsLayout").then((m) => ({ default: m.SettingsRedirect })));
const WorkspaceGuard = lazy(() => import("@/features/settings/SettingsLayout").then((m) => ({ default: m.WorkspaceGuard })));
const ToMyAccount = lazy(() => import("@/features/settings/SettingsLayout").then((m) => ({ default: m.ToMyAccount })));
const AccountSection = lazy(() => import("@/features/settings/AccountSection").then((m) => ({ default: m.AccountSection })));
const SecuritySection = lazy(() => import("@/features/settings/SecuritySection").then((m) => ({ default: m.SecuritySection })));
const NotificationsSection = lazy(() => import("@/features/settings/NotificationsSection").then((m) => ({ default: m.NotificationsSection })));
const AppearanceSection = lazy(() => import("@/features/settings/AppearanceSection").then((m) => ({ default: m.AppearanceSection })));
const OrganizationSection = lazy(() => import("@/features/settings/OrganizationSection").then((m) => ({ default: m.OrganizationSection })));
const TimeOffSection = lazy(() => import("@/features/settings/TimeOffSection").then((m) => ({ default: m.TimeOffSection })));
const SchedulingSection = lazy(() => import("@/features/settings/SchedulingSection").then((m) => ({ default: m.SchedulingSection })));
const RolesSection = lazy(() => import("@/features/settings/RolesSection").then((m) => ({ default: m.RolesSection })));
const DataSection = lazy(() => import("@/features/settings/DataSection").then((m) => ({ default: m.DataSection })));

/** The Settings routes inside a workspace. Workspace sections exist for HR only and are guarded. */
function settingsRoutes(admin = false) {
  return (
    <Route path="settings" element={<SettingsLayout />}>
      <Route index element={<Navigate to="account" replace />} />
      <Route path="account" element={<AccountSection />} />
      <Route path="security" element={<SecuritySection />} />
      <Route path="notifications" element={<NotificationsSection />} />
      <Route path="appearance" element={<AppearanceSection />} />
      {admin && (
        <>
          <Route path="organization" element={<WorkspaceGuard section="organization"><OrganizationSection /></WorkspaceGuard>} />
          <Route path="time-off" element={<WorkspaceGuard section="time-off"><TimeOffSection /></WorkspaceGuard>} />
          <Route path="scheduling" element={<WorkspaceGuard section="scheduling"><SchedulingSection /></WorkspaceGuard>} />
          <Route path="roles" element={<WorkspaceGuard section="roles"><RolesSection /></WorkspaceGuard>} />
          <Route path="data" element={<WorkspaceGuard section="data"><DataSection /></WorkspaceGuard>} />
        </>
      )}
      <Route path="*" element={<ToMyAccount />} />
    </Route>
  );
}
const ManagerCases = lazy(() => import("@/features/manager/ManagerCases").then((m) => ({ default: m.ManagerCases })));

/** Attendance approvals now live on the Approvals page; old links keep their tab. */
function AttendanceApprovalsMoved() {
  const tab = new URLSearchParams(useLocation().search).get("tab") ?? "overtime";
  return <Navigate to={`/manager/approvals?tab=${tab}`} replace />;
}

function App() {
  const { user } = useAuth();
  // Re-render every screen when a preference (date format, timezone…) changes.
  usePreferencesVersion();
  // Apply the signed-in person's saved preferences before paint (no flash); defaults when signed out.
  // The theme isn't touched: it belongs to this device (moon toggle).
  const prefsKey = user ? settingsKeyFor(user) : null;
  useLayoutEffect(() => {
    if (!prefsKey) return resetPreferences();
    const saved = settingsFor(prefsKey);
    applyAppearance(saved.appearance, { theme: false });
    applyAccountPrefs(saved.account);
  }, [prefsKey]);

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
            <Route path="/settings/*" element={<SettingsRedirect />} />

            <Route
              path="/employee"
              element={
                <ProtectedRoute role="employee">
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<EmployeeOverview />} />
              <Route path="leave" element={<EmployeeLeave />} />
              <Route path="attendance" element={<EmployeeAttendance />} />
              <Route path="leave-dtr" element={<Navigate to="/employee/leave" replace />} />
              <Route path="payslips" element={<EmployeePayslips />} />
              <Route path="201-file" element={<Employee201File />} />
              <Route path="certificates" element={<EmployeeCertificates />} />
              <Route path="benefits" element={<EmployeeBenefitsPage />} />
              <Route path="trainings" element={<EmployeeTrainings />} />
              <Route path="policies" element={<EmployeePolicies />} />
              <Route path="reimbursements" element={<EmployeeReimbursements />} />
              {settingsRoutes()}
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
              <Route path="attendance-approvals" element={<AttendanceApprovalsMoved />} />
              <Route path="workforce" element={<ManagerWorkforcePage />} />
              <Route path="performance" element={<ManagerPerformance />} />
              <Route path="trainings" element={<ManagerTrainings />} />
              <Route path="cases" element={<ManagerCases />} />
              <Route path="payroll" element={<ManagerPayroll />} />
              <Route path="reports" element={<Navigate to="/manager/reports/overtime" replace />} />
              <Route path="reports/:reportId" element={<ManagerReportPage />} />
              {settingsRoutes()}
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminHome />} />

              {/* Maintenance: Core HR, Leave and Rules */}
              <Route path="maintenance" element={<Navigate to="/admin/maintenance/people" replace />} />
              <Route path="maintenance/people" element={<PeoplePage />} />
              <Route path="maintenance/people/new" element={<NewEmployeePage />} />
              <Route path="maintenance/people/:employeeId" element={<EmployeePage />} />
              <Route path="maintenance/departments" element={<DepartmentsPage />} />
              <Route path="maintenance/locations" element={<LocationsPage />} />
              <Route path="maintenance/org-chart" element={<OrgChartPage />} />
              <Route path="maintenance/documents" element={<DocumentsPage />} />
              <Route path="maintenance/leave" element={<Navigate to="/admin/maintenance/leave/overview" replace />} />
              <Route path="maintenance/leave/overview" element={<LeaveOverviewPage />} />
              <Route path="maintenance/leave/requests" element={<LeaveRequestsPage />} />
              <Route path="maintenance/leave/balances" element={<BalancesPage />} />
              <Route path="maintenance/leave/types" element={<LeaveTypesPage />} />
              <Route path="maintenance/rules" element={<RulesPage />} />

              {/* Time & Attendance (its own module) */}
              <Route path="timekeeping" element={<Navigate to="/admin/timekeeping/shifts" replace />} />
              <Route path="timekeeping/shifts" element={<ShiftsPage />} />
              <Route path="timekeeping/schedules" element={<SchedulesPage />} />
              <Route path="timekeeping/remote" element={<RemoteDaysPage />} />
              <Route path="timekeeping/holidays" element={<HolidayCalendarPage />} />

              {/* Requests: every request type (reimbursements today) */}
              <Route path="requests" element={<RequestsPage />} />
              <Route path="requests/:type" element={<RequestsPage />} />

              {/* Reports: attendance records, then HR and management reports */}
              <Route path="reports" element={<Navigate to="/admin/reports/attendance-logs" replace />} />
              <Route path="reports/attendance-logs" element={<AttendanceLogsPage />} />
              <Route path="reports/overtime" element={<OvertimePage />} />
              <Route path="reports/undertime" element={<UndertimePage />} />
              <Route path="reports/time-adjustments" element={<CorrectionsPage />} />
              <Route path="reports/tardiness" element={<TardinessPage />} />
              <Route path="reports/dashboard" element={<Navigate to="/admin/reports/hr" replace />} />
              <Route path="reports/hr" element={<HrReportsPage />} />
              <Route path="reports/leave" element={<LeaveReportsPage />} />
              <Route path="reports/attendance" element={<AttendanceReportsPage />} />
              <Route path="reports/payroll" element={<PayrollReportsPage />} />
              <Route path="reports/statutory" element={<StatutoryReportsPage />} />
              <Route path="reports/management" element={<ManagementReportsPage />} />

              {/* Payroll (unchanged) */}
              <Route path="payroll" element={<Navigate to="/admin/payroll/runs" replace />} />
              <Route path="payroll/runs" element={<PayrollRunsPage />} />
              <Route path="payroll/runs/:id" element={<PayrollRunPage />} />
              <Route path="payroll/contributions" element={<ContributionsPage />} />
              <Route path="payroll/pay-details" element={<PayDetailsPage />} />
              <Route path="payroll/loans" element={<LoansPage />} />
              <Route path="payroll/final-pay" element={<FinalPayPage />} />
              <Route path="payroll/payouts" element={<PayoutsPage />} />
              <Route path="payroll/year-end" element={<YearEndPage />} />

              {/* Onboarding */}
              <Route path="onboarding" element={<Navigate to="/admin/onboarding/trainings" replace />} />
              <Route path="onboarding/trainings" element={<TrainingsPage />} />

              <Route path="administration" element={<Navigate to="/admin/administration/users" replace />} />
              <Route path="administration/users" element={<UsersPage />} />
              <Route path="administration/roles" element={<RolesPage />} />
              <Route path="administration/audit" element={<AuditTrailPage />} />
              <Route path="administration/settings" element={<SystemSettingsPage />} />
              <Route path="administration/subscription" element={<SubscriptionPage />} />
              <Route path="administration/outbox" element={<OutboxPage />} />
              <Route path="directory" element={<DirectoryRedirect />} />

              {/* Old addresses, kept so links and bookmarks still work */}
              <Route path="core-hr" element={<Moved to="/admin/maintenance/people" />} />
              <Route path="people" element={<Moved to="/admin/maintenance/people" />} />
              <Route path="people/new" element={<Moved to="/admin/maintenance/people/new" />} />
              <Route path="people/:employeeId" element={<Moved to="/admin/maintenance/people/:employeeId" />} />
              <Route path="org-chart" element={<Moved to="/admin/maintenance/org-chart" />} />
              <Route path="company" element={<Moved to="/admin/maintenance/org-chart" />} />
              <Route path="organization" element={<Moved to="/admin/maintenance/org-chart" />} />
              <Route path="positions" element={<Moved to="/admin/maintenance/org-chart" />} />
              <Route path="documents" element={<Moved to="/admin/maintenance/documents" />} />
              <Route path="leave" element={<Moved to="/admin/maintenance/leave/overview" />} />
              <Route path="leave/overview" element={<Moved to="/admin/maintenance/leave/overview" />} />
              <Route path="leave/requests" element={<Moved to="/admin/maintenance/leave/requests" />} />
              <Route path="leave/balances" element={<Moved to="/admin/maintenance/leave/balances" />} />
              <Route path="leave/types" element={<Moved to="/admin/maintenance/leave/types" />} />
              <Route path="time" element={<Moved to="/admin/timekeeping/shifts" />} />
              <Route path="maintenance/attendance" element={<Moved to="/admin/timekeeping/shifts" />} />
              <Route path="maintenance/attendance/:page" element={<Moved to="/admin/timekeeping/:page" />} />
              <Route path="timekeeping/logs" element={<Moved to="/admin/reports/attendance-logs" />} />
              <Route path="timekeeping/overtime" element={<Moved to="/admin/reports/overtime" />} />
              <Route path="timekeeping/undertime" element={<Moved to="/admin/reports/undertime" />} />
              <Route path="timekeeping/corrections" element={<Moved to="/admin/reports/time-adjustments" />} />
              <Route path="timekeeping/tardiness" element={<Moved to="/admin/reports/tardiness" />} />
              <Route path="claims" element={<Moved to="/admin/requests" />} />
              <Route path="reimbursements" element={<Moved to="/admin/requests/reimbursement" />} />
              <Route path="administration/workflows" element={<Moved to="/admin/maintenance/rules" />} />
              {settingsRoutes(true)}
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
        {user && <SignInWelcome key={user.accountId ?? user.role} />}
      </div>
    </OfficeFilterProvider>
  );
}

export default App;
