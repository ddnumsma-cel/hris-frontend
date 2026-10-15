# Where the screens get and save their data

For the backend developer. Today there is no server: every screen saves its data **in the user's own browser** (localStorage) as a placeholder. Each row below is one place a backend has to take over.

- **Code file**: where the screens call for the data. Replace what this file does with calls to your server.
- **Saved as**: the browser storage name used today (open the browser's DevTools › Application › Local Storage to see the data and its shape).
- **Screens**: where you see it in the app.

Who may do what is written in one table, `src/lib/permissions.ts`. Each code file checks it at the top of every action (`deny(...)`); the server should do the same check.

## People and accounts

| What | Code file | Saved as | Screens |
|---|---|---|---|
| Employees and their 201 file (personal, job, salary, government numbers, bank, family, documents list), departments, positions, offices | `src/lib/corehr/api.ts`, `corehr/store.ts` | `heyhr-corehr-v4` | Maintenance › People, Departments, Locations, Org chart, 201 documents; employee 201 File |
| Uploaded files (IDs, 201 documents, policy PDFs, receipts) | `src/lib/fileStore.ts` | browser database `heyhr-files` | Every upload |
| Sign-in accounts, roles, approval workflows, audit trail, system settings | `src/lib/admin/api.ts`, `admin/store.ts`, `admin/auth.ts`, `admin/approvers.ts` | `heyhr-admin-v3` | Login, Administration › Users, Roles & access, Audit trail, System settings; Maintenance › User accounts, Rules (workflows) |
| Demo passwords | `src/lib/credentials.ts` | `msma-hris-credentials-v2` | Login (remove for real use) |
| Who is signed in | `src/lib/session.ts`, `features/auth/AuthContext.tsx` | `msma-hris-account`, `msma-hris-role`, `msma-hris-signed-in-at` | Everywhere |
| Face ID enrolled (yes/no per employee) | `src/lib/faceId.ts` | `heyhr-face-enrolled-v1` | Face ID pop-up after sign-in, Home clock-in, 201 File › Face ID |
| My account details and photos | `src/lib/settings/api.ts` | `heyhr-account-profiles-v1`, `heyhr-profile-photos-v1` | Settings › Account |
| Company and personal settings (leave rules, scheduling rules, preferences) | `src/lib/settings/store.ts` | `heyhr-settings-v1` | Settings (all sections) |

## Time and leave

| What | Code file | Saved as | Screens |
|---|---|---|---|
| Shifts, schedules, clock-ins (punches), time adjustments, overtime/undertime requests, remote work days, lateness notices | `src/lib/timekeeping/api.ts`, `timekeeping/store.ts` | `heyhr-timekeeping-v1` | Attendance › Shifts, Schedules, Remote work days; Reports › Attendance logs, Overtime, Undertime, Time adjustments, Tardiness; employee Attendance, Overtime, Undertime; Home clock-in |
| Holidays | `src/lib/holidays.ts` | `heyhr-holidays-v1` | Attendance › Holiday calendar |
| Leave types, credits, requests and approvals | `src/lib/leave/api.ts`, `leave/store.ts` | `heyhr-leave-v1` | Maintenance › Leave; employee Leave |

## Pay

| What | Code file | Saved as | Screens |
|---|---|---|---|
| Payroll runs (each cut-off's computed pay, approval, payslips) | `src/lib/pay/runs.ts` | `heyhr-payroll-runs-v1` | Payroll › Payroll runs; employee Payslips |
| Paydays (10th / 25th) and each employee's pay settings | `src/lib/pay/settings.ts` | `heyhr-pay-rules-v1`, `heyhr-pay-profiles-v1` | Payroll › Pay details |
| Loans and cash advances | `src/lib/pay/loans.ts`, `pay/loanStore.ts` | `heyhr-loans-v2` | Payroll › Loans & deductions |
| Final pay | `src/lib/pay/finalpay.ts`, `pay/finalPayStore.ts` | `heyhr-final-pay-v1` | Payroll › Final pay |
| SSS, PhilHealth, Pag-IBIG and BIR tax tables | `src/lib/reports/statutory.ts`, `lib/contributions.ts` | `heyhr-contributions-v1` | Payroll › Government contributions |
| Reimbursements (claims) | `src/lib/reimbursements/api.ts`, `reimbursements/store.ts` | `heyhr-reimbursements-v1` | Requests › Reimbursements; employee Reimbursements |
| Pay calculation (no saving, just the formulas) | `src/lib/pay/engine.ts` | — | Used by payroll runs. Rules and worked examples: `npm run check:payroll` |
| Bank lists and journal entry (no saving, read from runs) | `src/lib/pay/exports.ts` | — | Payroll › Payouts & journal |
| Year-end 2316 and 13th month (no saving) | `src/lib/pay/yearend.ts` | — | Payroll › Year-end BIR forms |

## Requests, messages and company

| What | Code file | Saved as | Screens |
|---|---|---|---|
| Certificate requests | `src/lib/api.ts` (with `lib/certificates.ts`) | `heyhr-certificate-requests-v1` | Requests › Certificates; employee Certificates |
| Company policies and who has read them | `src/lib/policies.ts` | `heyhr-policies-v1` | Maintenance › Rules; employee Company policies |
| Bell notifications | `src/lib/notifications.ts`, `lib/requestNotices.ts` | `heyhr-notifications-v1` | The bell in the top bar |
| Emails and texts the system would send | `src/lib/outbox.ts` | `heyhr-outbox-v1` | Administration › Email & text outbox (to be replaced by real email/SMS) |
| Support tickets | `src/lib/support/store.ts` | `support-tickets` | Administration › Support tickets |
| Subscription, seats and clients | `src/lib/subscription/api.ts`, `subscription/store.ts` | `heyhr-subscription-v1` | Administration › Clients & Subscriptions; seat chip in the top bar |
| Employee self-service pages (requests list, who's out, my approver) | `src/lib/ess/api.ts`, `ess/more.ts` | reads the stores above | Employee Home, All requests |
| Reports | `src/lib/reports/api.ts` | reads the stores above | Reports › all |

## Still sample data only (not saved; resets on reload)

`src/lib/api.ts` with `src/lib/mockData.ts` holds older sample data that isn't saved anywhere: announcements, HMO and benefits, trainings, company assets, professional licenses, employee cases, team figures for the Partner workspace, and the older Partner payroll screen. These need real storage too.

## Screen-only (not business data; can stay in the browser)

Theme (`msma-hris-theme`), sidebar open/closed (`sidebar-collapsed`), list view choices (`heyhr-people-view`, `heyhr-documents-view`), walkthrough seen (`msma-hris-tour-seen`), Face ID "remind me later" (`heyhr-face-prompt-later`).
