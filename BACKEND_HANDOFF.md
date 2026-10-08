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
`fetchAdminOverviewStats`, `fetchPayrollRunSteps`, `fetchHeadcountByOffice`, `fetchPayrollCostBreakdown`, `fetchComplianceCalendar`, `updateComplianceStatus`, `createComplianceItem`, `updateComplianceItem`, `deleteComplianceItem`, `fetchEmployeeDirectory`, `createEmployee`, `updateEmployee`, `deleteEmployee`, `registerEmployee`, `fetchOnboardingPipeline`, `fetchJobRequisitions`, `fetchOrgChart`, `fetchOffboardingCases`, `createOffboardingCase`, `updateOffboardingCase`, `deleteOffboardingCase`, `fetchCompanyAssets`, `createCompanyAsset`, `updateCompanyAsset`, `deleteCompanyAsset`, `fetchAllTrainingRecords`, `createTrainingRecord`, `deleteTrainingRecord`, `fetchCertificateRequestsForReview`, `advanceCertificateRequest`, `updateCertificateRequest`, `deleteCertificateRequest`, `createAnnouncement`

Shared across roles: `fetchEmployeeCases`/case management and `fetchCertificateRequests`/review live on both the manager and admin side, filtered differently — check how each screen calls them in `src/features/manager/` vs `src/features/admin/`.

## Roles and permissions

The access matrix is `src/lib/permissions.ts` (`PERMISSIONS`, `LIMITS`); a real server must apply the same table on every endpoint. Today the mock API does it with `deny()` / `visible()` from `src/lib/session.ts`, which reads the signed-in account like a session cookie and answers 403 (`ForbiddenError`, `status: 403`) when a role or scope doesn't allow the call:

- Roles: `system_admin` (no client data; plan/seats, creating a client's Super Admin, platform audit events), `super_admin` (everything in the company), `hr`, `approver` (their direct reports, from Core HR `supervisorId`), `accounting`, `employee` (own records).
- Scopes: "team" = the caller's direct reports; "own" = the caller's employee record (`employeeOfAccount`).
- Claims: `POST /claims/{id}/decision` is step 1 for the approver (status `pending` → `endorsed` or `rejected`, stores `approverDecidedBy/At/Note`) and the final step for accounting (`endorsed` → `approved` or `rejected`, stores `decidedBy/At/note`). Only `approved` claims are paid.
- Payroll: accounting creates and edits runs and gives the final approval (`approveRun`); only super_admin deletes a draft.
- Accounts: one account per employee record (409-style error "This person already has an account (username …)"); each role may only give the roles in `LIMITS.assignableRoles`.
- TODO: company IDs on every record for multi-company (system_admin), the subscription plan and seat limit.

## Settings (personal)

`src/lib/settings/api.ts` stands in for these; today they save to localStorage (`heyhr-settings-v1`, `heyhr-profile-photos-v1`, `heyhr-account-profiles-v1`). Types are in `src/lib/settings/store.ts`.

- `GET/PUT /me/settings` (`fetchMySettings`, `saveMySettings(section)`): account preferences (display name, language, timezone, date format, first day of week), notifications (master switch, event × channel matrix, quiet hours, digest), appearance (theme, density, reduce motion, landing page), security (two-factor flag).
- `GET/PUT /me/profile` (`fetchMyProfile`, `saveMyProfile`): name, title, email, phone, office, emergency contact, about, photo. Employees can't change name/title (HR-owned).
- `POST /me/password` (`changeMyPassword`): checks the current password, enforces the minimum length from System settings.
- `GET /me/sessions`, `POST /me/sessions/revoke` (`fetchMySessions`, `signOutOtherSessions`): needs a real session store; today only "this device" is listed and revoking is a no-op.
- Still to build on the server: two-factor enrolment (secret, QR, code check) and enforcing it at sign-in; sending email notifications and digests; deleting an employee's personnel photo; languages other than English.

## Settings (workspace, HR administrators)

`src/lib/settings/workspace.ts` and the existing `getSettings`/`saveSettings` in `src/lib/admin/api.ts`:

- `GET/PUT /settings/organization` (`getSettings`, `saveSettings`): company name, TIN, address, HR email, logo, default timezone, currency, work week, standard hours, fiscal year start, data retention, and the sign-in security rules. New fields are on `Settings` in `src/lib/admin/store.ts`.
- `GET/PUT /settings/leave-policy` (`getLeavePolicy`, `saveLeavePolicy`): half days, negative balance, default carry-over, accrual. Stored on `LeaveState.policy`.
- `GET/POST/DELETE /settings/holidays` (`getCustomHolidays`, `addCustomHoliday`, `removeCustomHoliday`): company holidays on top of the national list (`src/lib/holidays.ts`).
- `GET/PUT /settings/scheduling` (`getSchedulingRules`, `saveSchedulingRules`): overtime threshold (applied in `computeDay`), default break, publishing lead time. Stored on `TimekeepingState.rules`.
- `GET /exports/{employees|leave|accounts|audit}.csv` (`exportDataset`).
- Still to build on the server: deleting records older than the retention period; currency conversion (payroll is PHP-only); monthly/per-payroll leave accrual; a schedule publishing step; printing the company logo on documents.

## What still needs real design, not just an endpoint

- **Auth** — `credentials.ts` is a hardcoded array match. Needs a real login endpoint, session/JWT handling, and `AuthContext` updated to store a token instead of a mock user object.
- **Face scan** — pure animation today (`FaceScanDialog.tsx`), no actual image capture or matching. Needs a real decision on what "biometric" means here (device Face ID passthrough vs. server-side face matching) before backend work starts.
- **File uploads** — no upload flow exists anywhere yet (no document/photo attachments).
- **Pagination** — tables currently render whole arrays client-side. Real data at scale (years of payslips, hundreds of employees) will need server-side paging/filtering, which isn't wired into the frontend yet.
- **Error handling** — mock functions never fail, so there's almost no error-state UI. Real network calls will fail sometimes and most screens don't yet handle that gracefully.

## Suggested convention

Add a `VITE_API_BASE_URL` env var (`.env.local`, gitignored) and read it in `api.ts` via `import.meta.env.VITE_API_BASE_URL` instead of hardcoding a host.
