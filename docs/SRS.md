# Software Requirements Specification
## MSMA HRIS — Human Resource Information System

**Version:** 1.0
**Status:** Frontend prototype (mock data) — see §2.5 for what is real vs. simulated
**Prepared for:** MSMA Group internal use / project documentation

---

## 1. Introduction

### 1.1 Purpose
This document specifies the functional and non-functional requirements for the MSMA HRIS, a role-based web application covering leave, payroll visibility, attendance, employee records (201 File), compliance, training, recruitment, and offboarding for MSMA Group, a Philippine accounting and professional services firm (Audit & Assurance, Tax Advisory, Corporate Legal, Bookkeeping).

### 1.2 Scope
The system provides three role-based workspaces — **Employee**, **Manager (Partner)**, and **HR/Admin** — each with a tailored dashboard and feature set appropriate to that role's responsibilities. It is installable as a Progressive Web App (PWA) and is responsive across desktop and mobile.

Out of scope for this system: client engagement/billing tracking, general ledger or accounting functions, and government e-filing submission (filings are tracked and flagged, not transmitted).

### 1.3 Definitions and Acronyms
| Term | Meaning |
|---|---|
| 201 File | The Philippine HR term for an employee's personnel file (pre-employment documents, identity records, employment history) |
| DTR | Daily Time Record (attendance log) |
| CPD | Continuing Professional Development — required renewal credits for licensed professionals (e.g., CPAs) under PRC rules |
| PRC | Professional Regulation Commission (Philippines) |
| BIR | Bureau of Internal Revenue (Philippines) |
| SSS / PhilHealth / Pag-IBIG | Philippine mandatory government contribution agencies |
| COE | Certificate of Employment |
| NBI | National Bureau of Investigation (source of NBI Clearance) |
| PWA | Progressive Web App |

### 1.4 References
- `BACKEND_HANDOFF.md` — integration contract for connecting a real backend to this frontend.
- Philippine Data Privacy Act (2012) and standard PH labor/compliance practice, as applied to the compliance and 201 File modules.

### 1.5 Overview
Section 2 describes the product and its users at a high level. Section 3 lists specific functional and non-functional requirements by module. Section 4 describes external interfaces. Section 5 states current implementation status honestly, distinguishing built-and-working features from simulated ones and from work a real backend would still need to do.

---

## 2. Overall Description

### 2.1 Product Perspective
The system is a standalone single-page application (React + TypeScript + Vite). It is currently a **frontend-only prototype**: all data is held in memory on the client and reset on a hard page reload. It is architected so that a real backend can be connected without a frontend rewrite (see §2.5 and `BACKEND_HANDOFF.md`) — every screen reads and writes through one data-access layer, `src/lib/api.ts`.

### 2.2 Product Functions (summary)
- Authentication and role-based routing (Employee / Manager / HR)
- Employee self-service: leave filing, DTR/attendance, payslips, 201 File & documents, professional license/CPD tracking, certificate requests, benefits/HMO, trainings, Face ID enrollment, biometric clock-in/out
- Manager: team roster, leave approvals, attendance/workforce analytics, performance review tracking, team trainings, employee relations case filing, full 201 File access for direct reports, clock-in/out
- HR/Admin: employee directory (full CRUD), org chart, onboarding/offboarding pipelines, company asset register, company-wide trainings, compliance calendar, payroll run tracking, reports/export, certificate request processing, personnel document verification, announcements, clock-in/out
- Cross-cutting: automated "Needs your attention" alerts (expiring documents, overdue filings, pending approvals, aging requests), light/dark theme, mobile-responsive layouts, installable PWA, a rule-based data-aware assistant

### 2.3 User Classes and Characteristics
| Role | Description | Primary goals |
|---|---|---|
| Employee | Any staff member | Manage own leave, attendance, pay, records; stay informed of what needs action |
| Manager (Partner) | Team lead / department head | Approve requests, monitor team compliance and performance, manage team's HR records |
| HR/Admin | People Operations staff | Maintain company-wide records, run payroll, track statutory compliance, manage headcount lifecycle |

### 2.4 Operating Environment
Modern evergreen browsers (Chrome, Edge, Safari) on desktop and mobile. Served over HTTPS (required for camera-based Face ID capture on iOS). Installable to a device home screen as a PWA.

### 2.5 Design and Implementation Constraints — What Is Real vs. Simulated
This is stated explicitly because the system is a working prototype, not a production system, and every simulated feature is disclosed rather than presented as more capable than it is:

| Capability | Status |
|---|---|
| UI/UX, navigation, role-based views, responsive layout | Real, fully functional |
| CRUD operations across all modules | Real, functional against in-memory mock data |
| Automated alerts (expiry, overdue, aging) | Real — computed live from actual dates, not hand-set flags |
| Authentication | Simulated — fixed demo credential list, not a real identity provider |
| Face ID enrollment / clock-in | Simulated — a timed animation; no real camera capture or biometric matching |
| Fingerprint attendance (onsite) | Simulated — represents confirmation from a physical office scanner not modeled in this system |
| Document upload | Simulated — records that a file was chosen (filename, timestamp); no real file storage |
| Photo-as-avatar | Real within the browser session — an uploaded image is read and displayed as the user's avatar, but not persisted server-side |
| Data persistence | In-memory only; resets on hard page reload (not on client-side navigation) |
| AI assistant | Real, but rule-based/keyword-matched against live app data — not a general-purpose language model |
| Backend / database | Not implemented — this is the frontend half of the system; see `BACKEND_HANDOFF.md` |

### 2.6 Assumptions and Dependencies
- A real deployment requires a backend implementing the contract described in `BACKEND_HANDOFF.md`.
- Government-mandated numeric details (e.g., CPD unit counts, contribution rates) are modeled at a realistic but illustrative level and should be confirmed against current regulations before production use.

---

## 3. Specific Requirements

Requirements are grouped by module. Each is functional (F) unless marked non-functional (N).

### 3.1 Authentication & Access Control
- F: The system shall authenticate users against a credential list and route them to a role-specific workspace.
- F: The system shall support self-registration for new hires (simulated Google sign-in included as an option).
- F: The system shall redirect an already-authenticated user away from the login page.
- F: The system shall restrict each route to its intended role (Employee/Manager/Admin) via a protected-route guard.
- N (Security): Certain personnel data (identity documents, government ID numbers, health results) shall be visible only to HR and Manager roles; the Employee role shall see only submission status for their own records, never the sensitive fields once submitted.

### 3.2 Employee Self-Service
- F: View a personalized dashboard with pay, attendance, leave balance, and an auto-generated attention list.
- F: File a leave request by type (Vacation, Sick, Emergency, Bereavement) and track its status.
- F: View DTR/attendance history and on-time rate.
- F: View and print payslips with a full earnings/deductions breakdown.
- F: View and edit own 201 File core profile (contact info, emergency contact).
- F: View a checklist of required pre-employment/identity documents with status (Missing/Submitted/Verified/Not applicable) and upload, replace, or remove a submission before it is verified.
- F: View own professional license and CPD progress (for licensed roles) and log completed CPD units.
- F: Request certificates (COE, tax certificate, etc.) and track request status.
- F: Enroll Face ID and use it to clock in remotely; clock in/out onsite via simulated office scanner confirmation, with a live-updating elapsed-time display while clocked in.
- F: View and enroll in HMO/benefits, including dependents.
- F: View assigned trainings and mark completion.

### 3.3 Manager (Partner) Functions
- F: View team-level dashboard (headcount, attendance, pending approvals, workforce alerts, performance review progress).
- F: Approve or decline team leave requests, with aging surfaced automatically.
- F: View team roster and open any direct report's full 201 File (same detail level as HR).
- F: View team attendance trends and automatically detected workforce patterns (e.g., repeated lateness, overtime spikes).
- F: Track and update team performance review submission status.
- F: Assign and track team trainings.
- F: File and track employee relations cases for the team.
- F: Clock in/out with the same live timer as Employee.

### 3.4 HR/Admin Functions
- F: Maintain the employee directory (create, edit, remove employees; office/cluster filtering; search).
- F: View organization chart.
- F: Manage onboarding and offboarding pipelines.
- F: Maintain the company asset register (issue, edit, return, remove).
- F: Maintain company-wide training records.
- F: Maintain the statutory compliance calendar (SSS/PhilHealth/Pag-IBIG/BIR filings) with live overdue/due-soon computation.
- F: Track payroll run milestones with live status progression by date.
- F: Process certificate requests (advance status, edit, delete).
- F: View and export company reports (CSV).
- F: Manage company announcements.
- F: View, edit, verify, and remove any employee's personnel documents and personal profile (birth date, civil status, dependents), with all sensitive fields visible.
- F: Manage professional license/CPD records company-wide.
- F: Clock in/out with the same live timer as Employee and Manager.

### 3.5 Cross-Cutting Requirements
- F: The system shall surface a "Needs your attention" panel on each role's overview, computed live from real data (no manually-set flags) — covering overdue/due-soon compliance filings, expiring government IDs and professional licenses, aging approvals, missing personnel documents, and (HR only) retirement-eligibility by age.
- F: The system shall support light and dark themes, switchable from both the login page and the authenticated app, persisted across sessions.
- F: The system shall be usable on mobile screen widths without requiring horizontal zoom, with card-based layouts replacing data tables where appropriate.
- F: The system shall be installable as a PWA.
- F: The system shall provide a data-aware assistant that answers questions about the signed-in user's own real data (leave, payslips, team, compliance) using rule-based matching, with an honest fallback when a question isn't understood.
- N (Performance): Mock network operations shall simulate realistic latency (~350ms) so the UI's loading states are exercised and visible.
- N (Usability): Every destructive action (remove/delete) shall require explicit confirmation.
- N (Accessibility): Interactive elements shall have accessible labels; motion shall respect `prefers-reduced-motion`.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
Role-based sidebar navigation, top bar with search (HR), notifications, theme toggle, and user menu; card- and table-based content areas; modal dialogs for create/edit/confirm flows.

### 4.2 Hardware Interfaces
None implemented. The system is designed to eventually integrate with physical biometric attendance hardware (fingerprint/face scanners) — currently represented as simulated confirmations only.

### 4.3 Software Interfaces
None currently — the system operates on an in-memory mock data layer. `src/lib/api.ts` defines the full contract (function signatures and data shapes) a real backend must satisfy; see `BACKEND_HANDOFF.md`.

---

## 5. Appendix: Known Gaps for a Production System
- Real backend, database, and persistence.
- Real authentication/identity provider.
- Real file storage for uploaded documents.
- Real biometric capture and matching.
- Deeper performance-review content (currently a submission-status tracker, not a full appraisal form).
- Company-wide "missing documents" rollup view (currently per-employee only).
- Functional, event-driven notifications (currently a static badge).
- Self-service/anonymous employee grievance channel (currently manager-filed only).
