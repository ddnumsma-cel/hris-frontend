import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { ProtectedRoute, RootRedirect } from "@/components/layout/ProtectedRoute";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { DocumentTitle } from "@/components/layout/DocumentTitle";
import { NotFoundPage } from "@/components/layout/NotFoundPage";
import { PageLoadingFallback } from "@/components/layout/PageLoadingFallback";
import { useAuth } from "@/features/auth/AuthContext";
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
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>

        {user && (
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
