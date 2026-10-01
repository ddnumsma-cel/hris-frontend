# Pipeline, fixed Onboarding and Customize Directory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New hires fill a fixed Onboarding form and upload their 201 documents; HR completes employment in Pipeline; HR customizes what the empty-by-default Directory shows through an animated pop-up.

**Architecture:** Mock API layer (`src/lib/api.ts` + `mockData.ts`) gains a pending-submissions store; `submitOnboarding` stores, `completeOnboarding` reuses `createEmployee`. Directory display is driven by a field registry (`directoryFields.ts`) persisted per HR user in localStorage and consumed by both card and table views.

**Tech Stack:** React 19, TypeScript, react-hook-form + zod, TanStack Query, Tailwind v4, CSS keyframes.

**Spec:** `docs/superpowers/specs/2026-10-01-pipeline-directory-customize-design.md`

## Global Constraints

- No test runner exists: each task verifies with `npm run build` (tsc + vite) and `npm run lint`; final task walks the flow in the browser.
- Only `transform`/`opacity` animate; every animation ≤ 320ms except the 600ms reorder highlight; `prefers-reduced-motion: reduce` makes them instant.
- All `localStorage` access in try/catch.
- Copy speaks to the employee in Onboarding ("you"), to HR in admin screens.
- Commit after each task (local only, never push).

## Review Focus

- Empty directory: every screen that looks up an employee by ID must render without throwing (Org Chart, Payroll, manager roster, cases, reports).
- A saved Onboarding draft from the old form (with employment fields / `receivedDocuments`) must load without crashing.
- A customize setting saved with an unknown or removed field key must be ignored on load.
- Completing two submissions hired the same month renumbers IDs correctly (existing `assignHireDateIds`).
- Uploading then removing a document on Onboarding leaves it Missing in the 201 file.

---

### Task 1: Data layer — empty directory, submissions store, document uploads

**Files:** Modify `src/lib/mockData.ts`, `src/lib/api.ts`, `src/lib/types.ts`

**Interfaces — Produces:**
- `types.ts`: `interface UploadedDocument { type: PersonnelDocumentType; fileName: string }`; `interface OnboardingSubmission { id: string; submittedAt: string; input: OnboardingSubmissionInput }`.
- `api.ts`: `type EmploymentInput = Pick<CreateEmployeeInput, "position"|"department"|"office"|"cluster"|"dateHired"|"employmentStatus"|"reportsToId">`; `type OnboardingSubmissionInput = Omit<CreateEmployeeInput, keyof EmploymentInput | "applicantId" | "actor">`; `submitOnboarding(input): Promise<OnboardingSubmission>`; `fetchOnboardingSubmissions(): Promise<OnboardingSubmission[]>`; `fetchMyOnboardingStatus(): Promise<"none"|"pending"|"done">`; `completeOnboarding(id, employment, actor?): Promise<Employee>`.
- `CreateEmployeeInput.uploadedDocuments?: UploadedDocument[]` replaces `receivedDocuments`; `applicableDocuments` removed (derived from civil status, dependents, license, previous employer).

- [ ] Empty `employeeDirectory`, `personnelProfiles`, `personnelDocuments`, `auditLogEntries`; delete `onboardingPipeline` + `OnboardingStage`.
- [ ] Rewrite `buildNewHireDocuments(employeeId, governmentId, uploads, applicable, license)`.
- [ ] Add submissions store + the four API functions; `completeOnboarding` re-points `currentEmployee`.
- [ ] Remove non-null assertions on directory lookups in api.ts.
- [ ] `npm run build` (expect UI errors fixed in later tasks), commit with Task 2.

### Task 2: Fixed Onboarding form with uploads

**Files:** Delete `ChoicesModal.tsx`, `BuildingForm.tsx`, `choices.ts`, `EmploymentStep.tsx` (picker moves to Task 3). Modify `schemas.ts`, `model.ts`, `OnboardingPage.tsx`, `IdentityStep.tsx`, `ContactStep.tsx`, `GovernmentStep.tsx`, `ReviewStep.tsx`.

- [ ] Schema: drop employment fields and the cluster refine; `receivedDocuments` → `uploadedDocuments: {type, fileName}[]`. Add `employmentSchema` (same employment rules + cluster refine).
- [ ] `model.ts`: four steps; `onboardingResolver()` (spouse required when Married; dependent rows with a birth date need a name); `applicableDocuments(values)`; `toSubmissionInput(values, governmentId)`; draft loader strips unknown keys.
- [ ] Identity: spouse field when Married; dependents list always (zero rows OK); blood type always.
- [ ] Contact: "Work background (if any)" group with license + previous employer.
- [ ] Government: upload rows per document with Upload / Replace / Remove.
- [ ] Review: uploaded vs missing documents.
- [ ] Page: no modal; submit via `submitOnboarding`; "Sent to HR" success screen.
- [ ] Build + lint, commit.

### Task 3: Pipeline page + Set up employment dialog

**Files:** Create `src/features/admin/pipeline/AdminPipelinePage.tsx`, `SetUpEmploymentDialog.tsx`, `SubmissionSummaryDialog.tsx`; delete `AdminOnboardingPage.tsx`; modify `App.tsx`, `AdminLayout.tsx`, `DocumentTitle.tsx`, `AdminOverview.tsx`, `Employee201File.tsx`.

- [ ] Route `/admin/pipeline`, redirect `/admin/onboarding`; nav label "Pipeline".
- [ ] List + empty state; summary dialog; set-up dialog (department-first position picker, ID preview) → `completeOnboarding` → toast with View profile.
- [ ] Overview's onboarding card shows the pending count.
- [ ] Employee 201 File: pending / not-started states when there are no documents.
- [ ] Build + lint, commit.

### Task 4: Customize Directory

**Files:** Create `src/features/admin/directory/directoryFields.ts`, `CustomizeDirectoryDialog.tsx`; modify `AdminPersonnelFiles.tsx`, `src/index.css`, `BACKEND_HANDOFF.md`.

- [ ] Field registry (key, label, hint, group, card + table renderers), defaults, `loadDirectoryFields(adminId)` dropping unknown keys, `saveDirectoryFields`, seen flag.
- [ ] Dialog: groups, switches, up/down reorder with FLIP, live preview card, Reset/Cancel/Save, check-draw on save; staggered entrance; reduced motion.
- [ ] Directory: auto-open on first visit, header "Customize directory" button, cards + table driven by fields, empty-directory state linking to Pipeline.
- [ ] Build + lint, commit.

### Task 5: Empty-directory sweep + browser verification

- [ ] Open Org Chart, Payroll Runs, Manager overview/roster/payroll, Cases, Reports, Overview with no employees; fix any crash.
- [ ] Walk spec Verification steps 1–6 in the browser.
- [ ] Commit.
