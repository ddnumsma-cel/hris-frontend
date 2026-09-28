# Product Backlog — MSMA HRIS

Status legend: ✅ Done (built and verified in the current prototype) · 🔲 Not started

Priority is for the **🔲 Not started** items only — it reflects impact if this were to become a real production system, not effort.

---

## Completed (✅) — by epic

| ID | Epic | Item |
|---|---|---|
| E-01 | Auth | Login, role-based routing, self-registration, simulated Google sign-in |
| E-02 | Auth | Light/dark theme on login + in-app, persisted |
| E-03 | Employee | Dashboard: pay, leave, attendance, 13th-month stat tiles |
| E-04 | Employee | Auto-generated "Needs your attention" panel |
| E-05 | Employee | Leave filing + history/status |
| E-06 | Employee | DTR/attendance history |
| E-07 | Employee | Payslip view + print |
| E-08 | Employee | HMO/benefits view + enroll + dependents |
| E-09 | Employee | 201 File — own profile view/edit |
| E-10 | Employee | 201 File — document checklist (upload / replace / remove before verification) |
| E-11 | Employee | 201 File — uploaded photo becomes avatar |
| E-12 | Employee | Professional license/CPD tracking + logging units |
| E-13 | Employee | Certificate requests + tracking |
| E-14 | Employee | Face ID enrollment (simulated) + remote clock-in |
| E-15 | Employee | Onsite clock-in/out + live elapsed timer |
| E-16 | Employee | Trainings view + mark complete |
| M-01 | Manager | Team dashboard: headcount, approvals, attendance, workforce alerts |
| M-02 | Manager | Leave approvals with aging flags |
| M-03 | Manager | Team roster + full 201 File access for direct reports |
| M-04 | Manager | Performance review status tracking |
| M-05 | Manager | Team training assignment/tracking |
| M-06 | Manager | Employee relations case filing |
| M-07 | Manager | Clock-in/out + live timer |
| A-01 | HR/Admin | Employee directory full CRUD |
| A-02 | HR/Admin | Org chart |
| A-03 | HR/Admin | Onboarding/offboarding pipelines |
| A-04 | HR/Admin | Company asset register (issue/edit/return) |
| A-05 | HR/Admin | Company-wide training records |
| A-06 | HR/Admin | Compliance calendar with live overdue/due-soon computation |
| A-07 | HR/Admin | Payroll run milestone tracking (date-driven) |
| A-08 | HR/Admin | Certificate request processing |
| A-09 | HR/Admin | Reports/CSV export |
| A-10 | HR/Admin | Announcements |
| A-11 | HR/Admin | 201 File full detail: view/edit/verify/remove documents, edit personal profile |
| A-12 | HR/Admin | Company-wide professional license/CPD management |
| A-13 | HR/Admin | Government ID / license expiry auto-flagging |
| A-14 | HR/Admin | Retirement-age auto-flagging |
| A-15 | HR/Admin | Clock-in/out + live timer |
| X-01 | Platform | Mobile-responsive layouts (card views, 2-col stat tiles) |
| X-02 | Platform | Installable PWA |
| X-03 | Platform | First-login walkthrough |
| X-04 | Platform | Data-aware rule-based assistant |
| X-05 | Platform | `BACKEND_HANDOFF.md` integration contract |

---

## Backlog — not yet built (🔲)

| ID | Priority | Item | Notes |
|---|---|---|---|
| B-01 | **P0** | Real backend + database | Everything above is mock/in-memory; this is the actual blocker to production use. `api.ts` is written to make this a swap-in, not a rewrite. |
| B-02 | **P0** | Real authentication/identity provider | Replaces the fixed demo-credential list. |
| B-03 | **P1** | Real file storage for document uploads | Currently records filename + timestamp only. |
| B-04 | **P1** | Real biometric capture/matching | Face ID and fingerprint are both simulated confirmations today. |
| B-05 | **P2** | Company-wide "missing documents" rollup view | Today this is per-employee only; HR must open each employee individually to find gaps. |
| B-06 | **P2** | Deeper performance review content | Currently tracks submission status only, not review questions/ratings/comments. |
| B-07 | **P2** | Functional, event-driven notifications | Bell icon is currently a static badge, not tied to real events. |
| B-08 | **P3** | Self-service/anonymous grievance channel | Cases are currently filed by a manager on an employee's behalf, not by the employee directly. |
| B-09 | **P3** | Independence / conflict-of-interest declarations | Discussed as an audit-firm-specific compliance need; not built (kept out of scope pending decision on internal-only vs. client-facing data). |
| B-10 | **P3** | Custom empty-state illustrations per module | A shared generic version exists app-wide; bespoke illustrations per context were considered and deferred as low value for the effort. |

### Explicitly ruled out (not backlog items)
- **Billable/chargeable hours & client engagement tracking** — reaches into client/engagement data, out of scope for an internal-only HRIS per explicit product decision.
- **Government e-filing submission** — filings are tracked and flagged for humans to act on, not transmitted to BIR/SSS/PhilHealth systems directly.
