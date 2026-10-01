# Backend integration guide

This is the MSMA HRIS frontend — React + Vite + TypeScript. Right now every screen reads and writes mock, in-memory data. This doc is what a backend developer needs to build the real API and wire it in.

## Running it locally

```
npm install
npm run dev
```

Opens on `https://localhost:5173` (self-signed dev cert in `.certs/`, gitignored — HTTPS is required for the camera-based face-scan feature to work on iOS). Demo logins are in `src/lib/credentials.ts`.

## How the connection works

Every piece of data in the app — every table, form, and chart — goes through one file: **`src/lib/api.ts`**. Right now each function looks like this:

```ts
export function fetchEmployeeDirectory() {
  return delay(employeeDirectory); // employeeDirectory = in-memory array
}
```

To connect a real backend, that becomes:

```ts
export function fetchEmployeeDirectory() {
  return fetch(`${API_BASE_URL}/employees`).then((r) => r.json());
}
```

**The function name, its parameters, and its return type stay the same.** Nothing outside `api.ts` needs to change — every component calls these functions through React Query and doesn't know or care whether the data came from an array or a network request. This means the endpoint list below can be built one at a time, and the frontend can point at real endpoints incrementally without a rewrite.

Two files are the actual API contract:
- **`src/lib/types.ts`** — the exact shape of every entity (Employee, Payslip, LeaveRequest, etc.) — this is your response schema.
- **`src/lib/api.ts`** — every function the frontend needs, i.e. every endpoint to build.

## Endpoints needed (grouped by area)

Each is a `fetch*` (read) or an action (write). Parameter/return types are the `*Input` types and entity types in `types.ts`, named to match.

**Employee self-service**
`fetchCurrentEmployee`, `updateEmployeeProfile`, `enrollFaceId`, `fetchLeaveBalances`, `createLeaveRequest`, `fetchMyLeaveRequests`, `cancelLeaveRequest`, `fetchPayslips`, `fetchMyDtrLog`, `fetchEmployeeDtrSummary`, `fetchEmployeeThirteenthMonth`, `fetchEmployeeBenefits`, `confirmBenefitEnrollment`, `addEmployeeBenefit`, `removeEmployeeBenefit`, `fetchMyAssets`, `fetchMyTrainingRecords`, `updateTrainingStatus`, `fetchCertificateRequests`, `createCertificateRequest`, `cancelCertificateRequest`, `fetchAnnouncements`

**Manager**
`fetchApprovalsQueue`, `updateApprovalStatus`, `fetchOnLeaveToday`, `fetchApprovedLeaveSchedule`, `fetchAttendanceTrend`, `fetchWorkforceAlerts`, `fetchTeamRoster`, `fetchTeamTrainingRecords`, `fetchPerformanceReviewStatuses`, `updatePerformanceReviewStatus`, `fetchEmployeeCases`, `createEmployeeCase`, `updateCaseStatus`, `updateCaseDetails`, `deleteEmployeeCase`

**Admin/HR**
`fetchAdminOverviewStats`, `fetchPayrollRunSteps`, `fetchHeadcountByOffice`, `fetchPayrollCostBreakdown`, `fetchComplianceCalendar`, `updateComplianceStatus`, `createComplianceItem`, `updateComplianceItem`, `deleteComplianceItem`, `fetchEmployeeDirectory`, `createEmployee`, `updateEmployee`, `deleteEmployee`, `registerEmployee`, `submitOnboarding` (employee), `fetchMyOnboardingStatus` (employee), `fetchOnboardingSubmissions`, `completeOnboarding`, `fetchJobRequisitions`, `fetchOrgChart`, `fetchOffboardingCases`, `createOffboardingCase`, `updateOffboardingCase`, `deleteOffboardingCase`, `fetchCompanyAssets`, `createCompanyAsset`, `updateCompanyAsset`, `deleteCompanyAsset`, `fetchAllTrainingRecords`, `createTrainingRecord`, `deleteTrainingRecord`, `fetchCertificateRequestsForReview`, `advanceCertificateRequest`, `updateCertificateRequest`, `deleteCertificateRequest`, `createAnnouncement`

Shared across roles: `fetchEmployeeCases`/case management and `fetchCertificateRequests`/review live on both the manager and admin side, filtered differently — check how each screen calls them in `src/features/manager/` vs `src/features/admin/`.

## What still needs real design, not just an endpoint

- **Auth** — `credentials.ts` is a hardcoded array match. Needs a real login endpoint, session/JWT handling, and `AuthContext` updated to store a token instead of a mock user object.
- **Face scan** — pure animation today (`FaceScanDialog.tsx`), no actual image capture or matching. Needs a real decision on what "biometric" means here (device Face ID passthrough vs. server-side face matching) before backend work starts.
- **File uploads** — no upload flow exists anywhere yet (no document/photo attachments).
- **Directory display settings** — which details the Employee Directory shows (Customize Directory) are saved in `localStorage` per HR user (`msma-directory-fields:<name>`, see `features/admin/directory/directoryFields.ts`). Move this to a per-user setting on the server so it follows HR across devices.
- **Pagination** — tables currently render whole arrays client-side. Real data at scale (years of payslips, hundreds of employees) will need server-side paging/filtering, which isn't wired into the frontend yet.
- **Error handling** — mock functions never fail, so there's almost no error-state UI. Real network calls will fail sometimes and most screens don't yet handle that gracefully.

## Suggested convention

Add a `VITE_API_BASE_URL` env var (`.env.local`, gitignored) and read it in `api.ts` via `import.meta.env.VITE_API_BASE_URL` instead of hardcoding a host.
