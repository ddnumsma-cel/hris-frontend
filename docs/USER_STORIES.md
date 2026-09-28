# User Stories — MSMA HRIS

Grouped by role and epic. Format: **As a `<role>`, I want to `<action>`, so that `<benefit>`.**
Stories marked ✅ are implemented and verified in the current prototype. Stories marked 🔲 are not yet built (see `BACKLOG.md`).

---

## Epic: Authentication & Onboarding

- ✅ As a **user**, I want to sign in with a username and password, so that I can access my role-specific workspace.
- ✅ As a **new hire**, I want to register an account (including a simulated Google sign-in option), so that I can get access without waiting on IT to provision me manually.
- ✅ As a **returning user**, I want to be redirected straight to my dashboard if I'm already signed in, so that I don't have to log in again every time I open the app.
- ✅ As a **user**, I want light/dark mode available on the login page itself, so that I don't get blinded by a bright screen at night before I've even logged in.

## Epic: Employee — Self-Service Dashboard

- ✅ As an **employee**, I want to see my net pay, leave balance, attendance rate, and 13th-month accrual at a glance, so that I don't have to dig through separate pages for basic facts about my own employment.
- ✅ As an **employee**, I want a "Needs your attention" list generated automatically, so that I know what requires action from me without having to check every module manually.
  - *Acceptance:* the list reflects real state (e.g., a genuinely missing document, an actually-expiring CPD deadline) and disappears once resolved.
- ✅ As an **employee**, I want to clock in and out and see a live-running "time since clock-in" indicator, so that I have a clear, visible confirmation my attendance is being tracked for the day.
- ✅ As an **employee**, I want to clock in remotely using Face ID once I've enrolled it, so that I don't need a physical office scanner to log attendance when working from home.

## Epic: Employee — Leave & Attendance

- ✅ As an **employee**, I want to file a leave request by type and date range, so that my manager can review and approve it.
- ✅ As an **employee**, I want to see my leave request history and its approval status, so that I know where each request stands.
- ✅ As an **employee**, I want to view my DTR and on-time rate, so that I can track my own attendance record.

## Epic: Employee — Pay & Benefits

- ✅ As an **employee**, I want to view and print my payslips with a full breakdown, so that I have a record for loan applications, tax filing, or my own reference.
- ✅ As an **employee**, I want to view and enroll in HMO/benefits, including adding dependents, so that my coverage is accurate and up to date.

## Epic: Employee — 201 File & Personnel Documents

- ✅ As an **employee**, I want to see a checklist of required documents (Birth Certificate, valid ID, NBI clearance, etc.) and my submission status for each, so that I know exactly what HR still needs from me.
- ✅ As an **employee**, I want to upload a document that's missing, so that I can complete my file without going through HR in person.
- ✅ As an **employee**, I want to replace or remove a document I already submitted (before HR verifies it), so that I can fix a mistake myself instead of waiting on HR to do it.
- 🔲 As an **employee**, I want to know once HR has verified vs. merely received a document, so that I'm not left guessing whether it's actually accepted. *(Status is tracked; a stronger notification isn't built yet — see Backlog.)*
- ✅ As an **employee**, I want my uploaded ID photo to become my profile picture, so that my account looks like me instead of a generic set of initials.
- ✅ As an **employee** who holds a professional license, I want to see my CPD progress and log completed units, so that I don't lose my license to a missed renewal deadline.

## Epic: Manager — Team Oversight

- ✅ As a **manager**, I want to see my team's headcount, pending approvals, attendance rate, and flagged workforce patterns at a glance, so that I can spot problems before they escalate.
- ✅ As a **manager**, I want approvals that have waited too long to be flagged automatically, so that nothing sits ignored in my queue.
- ✅ As a **manager**, I want to approve or decline leave requests from one screen, so that I don't have to track them down individually.
- ✅ As a **manager**, I want to open any direct report's full 201 File — the same detail HR sees — so that I can act on my own team's records (e.g., confirm a document, check an ID expiry) without routing every question through HR.
- ✅ As a **manager**, I want to track my team's performance review submission status, so that I know who still needs to complete theirs before the deadline.
- ✅ As a **manager**, I want to assign trainings to my team and see completion status, so that I can keep the team compliant with required courses.
- ✅ As a **manager**, I want to file an employee relations case, so that workplace concerns are documented and routed to HR.
- ✅ As a **manager**, I want my own clock-in/out with a live timer, so that my attendance is tracked the same way my team's is.

## Epic: HR/Admin — Company-Wide Records

- ✅ As an **HR admin**, I want to view, add, edit, and remove employees in a company-wide directory, so that the org's headcount records stay accurate.
- ✅ As an **HR admin**, I want to view the organization chart, so that I can see reporting lines at a glance.
- ✅ As an **HR admin**, I want to track onboarding and offboarding pipelines, so that new hires and exits follow a consistent process.
- ✅ As an **HR admin**, I want to open any employee's full 201 File, verify or reset a submitted document, and edit personal profile fields (birth date, civil status, dependents), so that the company's personnel records stay correct and audit-ready.
- ✅ As an **HR admin**, I want government ID and professional license expiries flagged automatically company-wide, so that I don't have to manually track renewal dates for every employee.
- ✅ As an **HR admin**, I want employees approaching the optional retirement age flagged, so that workforce planning isn't a surprise.
- 🔲 As an **HR admin**, I want a single company-wide list of everyone with missing documents, so that I don't have to open each employee one at a time to find gaps. *(Not yet built — see Backlog.)*

## Epic: HR/Admin — Compliance & Payroll

- ✅ As an **HR admin**, I want the statutory compliance calendar (SSS/PhilHealth/Pag-IBIG/BIR) to show live overdue/due-soon status instead of a manually-updated flag, so that nothing is filed late because someone forgot to update a status field.
- ✅ As an **HR admin**, I want to mark a filing as filed, so that the calendar reflects reality.
- ✅ As an **HR admin**, I want to see payroll run milestones progress automatically as real dates pass, so that I always know exactly where the current cutoff stands.
- ✅ As an **HR admin**, I want to export a company report, so that I can share figures outside the system.

## Epic: HR/Admin — Assets, Training, Certificates

- ✅ As an **HR admin**, I want to issue, edit, and return company assets (laptops, IDs, phones), so that equipment accountability is tracked.
- ✅ As an **HR admin**, I want to maintain company-wide training records, so that compliance/upskilling completion is visible across the whole firm.
- ✅ As an **HR admin**, I want to process certificate requests (COE, tax certs) — advance their status, edit, or delete — so that employee requests get fulfilled and tracked.

## Epic: Cross-Cutting / Platform

- ✅ As **any user**, I want the app usable on my phone without pinch-zooming, so that I can check things on the go.
- ✅ As **any user**, I want to install the app to my home screen, so that it feels like a native app rather than a browser tab.
- ✅ As **any user**, I want a first-login walkthrough pointing out navigation, the attention panel, and the assistant, so that I'm not left to guess what's where.
- ✅ As **any user**, I want to ask an in-app assistant about my own data (leave, payslips, team, compliance) in plain language, so that I don't have to hunt through menus for a quick fact.
- 🔲 As **any user**, I want real, dismissible notifications tied to actual events, so that the notification bell means something beyond a static badge. *(Not yet built — see Backlog.)*
