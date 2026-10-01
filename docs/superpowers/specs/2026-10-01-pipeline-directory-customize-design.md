# Pipeline, fixed Onboarding and Customize Directory — design

Date: 2026-10-01 · Branch: `feature/add-employee-id-uploads`

## Intent

- **New hires own their information.** Only the employee fills in their details and uploads
  their 201 documents, from Onboarding in the employee app. The form is the same for everyone.
- **HR owns the job.** A new hire doesn't know their department, position or start date, so HR
  adds those after the employee submits. The HR page where that happens is called **Pipeline**.
- **HR chooses what the directory shows.** Companies care about different details. A friendly
  "Customize Directory" pop-up lets HR pick which details appear and in what order, so the
  directory never feels crowded.
- **Start clean.** The directory has no sample employees; people appear only through
  Onboarding → Pipeline.

Success: an employee submits Onboarding with documents → their submission shows in Pipeline →
HR sets up employment → they appear in the Directory with an ID, their uploads awaiting
verification → the directory shows exactly the details HR picked.

## 1. Employee Onboarding — one fixed form

**Remove the per-employee customization.** Delete `ChoicesModal.tsx`, `BuildingForm.tsx` and
`choices.ts`, the "Change what I'll provide" button, the `msma-onboarding-choices` storage key,
and `ChoicesContext`/`useChoices` usages. Steps use `steps` from `model.ts` directly; validation
uses `zodResolver(addEmployeeSchema)` plus the conditional rules below.

**Steps:** Identity → Contact → Gov't IDs & documents → Review (four steps). The Employment step
and its fields (`position`, `department`, `cluster`, `office`, `dateHired`, `employmentStatus`,
`reportsToId`) leave the employee form and the schema the employee form validates against.

**Personal sections are always present, never required beyond the legal core:**
- Identity: spouse name appears when civil status is Married (required only then); a Dependents
  list with "Add dependent" (optional, zero rows allowed); blood type.
- Contact: address and emergency contact (optional, as today), then a **"Work background (if
  any)"** group holding PRC license (profession, number, expiry) and previous employer (name, last
  day). Both optional; a license number with no profession is fine.
- Required stays: last name, first name, birth date, sex, mobile.

**201 documents are uploaded here.** In Gov't IDs & documents, the "Tick what you can hand to
HR" checklist becomes one row per 201 document type (`PERSONNEL_DOCUMENT_TYPES`):
- Row shows the document name and its note; action **Upload** (file input, image or PDF).
- After choosing a file: file name, **Replace** and **Remove**.
- Valid Government ID is filled automatically from the ID scanned at the top of the form
  ("From the ID you uploaded"), with Replace available.
- Situational rows show only when they apply: Marriage Certificate when Married, Child's Birth
  Certificate when a Child dependent is listed, Professional License when a license number is
  entered, Certificate of Employment (Previous) when a previous employer is entered.
- Uploading is optional; anything skipped stays **Missing** and can be uploaded later from My
  201 File. Files stay in the browser as names + data URLs (mock), like the ID scan today.
- Review lists uploaded documents and the ones still missing.

**Submitting** no longer creates a directory record. It calls a new `submitOnboarding(input)`
that stores a **pending submission** (all personal fields, government numbers, ID scan,
uploaded documents, submitted timestamp, a generated `submissionId`). Success screen:

> **Sent to HR**
> HR will add your role and start date, then your 201 file opens.
> • Your documents are with HR for checking
> • Anything still missing can be uploaded from your 201 file later
> [Back to Overview]

The local draft is cleared on submit, as today. Duplicate check (`findPossibleDuplicates`) still
runs before submit against the directory and pending submissions.

## 2. HR Pipeline (renamed from Onboarding)

- Sidebar: "Onboarding" → **"Pipeline"** under Recruitment & Onboarding. Route
  `/admin/onboarding` → **`/admin/pipeline`**; the old path redirects. Page title "Pipeline".
- Remove the placeholder `onboardingPipeline` counts and `fetchOnboardingPipeline`; the
  `createEmployee` side effect that bumped "Offer accepted" goes too.
- Content: a card **"Awaiting employment details"** with a count, listing pending submissions
  newest first. Each row: avatar initials, name, submitted date, mobile, "N of M documents
  uploaded", **Set up employment** button. Clicking the name opens a read-only summary of what
  they submitted (personal, contact, government numbers, documents).
- Empty state: *"No new hires waiting"* — "Submissions from Onboarding appear here."
- **Set up employment** dialog: department → position (department-first picker reused from the
  old EmploymentStep), cluster, office, date hired, employment status, reports-to. Required:
  all except reports-to (defaults to HR admin). Save calls `completeOnboarding(submissionId,
  employment)`, which builds a `CreateEmployeeInput` and calls the existing `createEmployee`
  (hire-date ID, profile, documents), then removes the submission. Uploaded documents become
  **Submitted** with file name and upload date; skipped ones **Missing**; non-applying situational
  ones **Not applicable**.
- After save: toast "Added {name} as {position} · {id}" with a **View profile** link to
  `/admin/directory?employee={id}`.
- If the submission was made by the signed-in demo employee, `currentEmployee` is re-pointed to
  the new record so My 201 File shows their own uploads. Until then My 201 File shows "HR is
  finishing your setup" instead of a checklist.

## 3. Employee Directory

**Empty start.** Remove all seeded `employeeDirectory`, `personnelProfiles`,
`personnelDocuments` and `auditLogEntries` rows (the demo `currentEmployee` stays as the
signed-in account but is no longer listed). Other seeded data (payroll entries, leave, cases,
trainings, assets, applicants) stays; anything that looks up an employee must tolerate "not
found" — remove non-null assertions on directory lookups and show "—"/skip. Org Chart, team
roster, payroll and reports show empty states rather than crashing. Directory empty state:
*"No employees yet"* — "New hires appear here once HR sets up their employment in Pipeline."
with a link to Pipeline.

**Customize Directory pop-up.**
- Opens **automatically on HR's first visit** to the Directory (flag in `localStorage`, try/catch;
  if storage fails it simply doesn't auto-open). Afterwards it's reopened from a **"Customize
  directory"** link-style button at the top-right of the page header (`ContentHead` actions) —
  not in the filter/view-toggle row.
- Dialog, size `lg`, title **"Customize Directory"**, subtitle "Choose which details HR sees for
  each person. You can change this anytime."
- Body, two columns on desktop (stacked on mobile):
  - **Left: details list**, grouped with small uppercase group labels:
    - *Work* — Department, Office & cluster, Employment status, Date hired, Reports to
    - *Contact* — Work email, Mobile, Personal email, Emergency contact
    - *Personal* — Birth date, Civil status, Blood type
    - *Records* — 201 document progress, Government numbers
    Each row: label, one-line hint, a switch (`role="switch"`, labelled), and move up / move down
    icon buttons (disabled at the ends; reorder within the shown set). A pinned row at the top:
    "Name, photo and status · Always shown" with a lock icon.
  - **Right: live preview** — one sample directory card ("Juan Dela Cruz") rendered with the
    current picks and order, labelled "Preview".
- Footer: **Reset to default** (ghost, left); **Cancel** (ghost) and **Save** (primary) right.
  First-visit Cancel/× keeps the defaults and still marks the pop-up as seen.
- Visual: matches `Dialog` and the app tokens — hairline dividers between rows, 44px row height,
  switches in brand color, no heavy borders around every row, generous section spacing.
- Defaults (shown, in order): Department, Office & cluster, Work email, Mobile, Date hired,
  201 document progress.
- One setting drives **both** the card view (detail lines inside the card, in order) and the
  table view (columns, in order). Name/photo/status always render.
- Saved per HR user in `localStorage` (`msma-directory-fields:{adminId}`), try/catch; unknown
  keys are dropped on load. `BACKEND_HANDOFF.md` notes it should move to a user setting.
- Details with no value render a muted "—" (cards) or empty cell (table).

**Motion in the pop-up.** Restrained, product-grade motion built with CSS keyframes/transitions
alongside the existing `overlay-in` / `panel-in` / `rise-in` animations in `index.css`. Only
`transform` and `opacity` are animated, with ease-out curves, and nothing exceeds 320ms:
- **Open:** backdrop fades in (180ms); the panel scales 0.96→1 and rises 8px (240ms,
  `cubic-bezier(0.2, 0.8, 0.2, 1)`). The group sections then **stagger in** — 40ms apart,
  fading and rising 6px — so the list settles from top to bottom. The preview card follows the
  last group.
- **Switch:** the thumb slides and the track fills with brand color (160ms). The matching line
  in the preview card **expands or collapses** its height while fading (200ms), so HR sees where
  the detail lands.
- **Reorder:** move up/down swaps the two rows with a FLIP slide (200ms), and the preview card
  lines swap the same way. The moved row gets a brief brand-tint highlight that fades out
  (600ms).
- **Reset to default:** rows and preview cross-fade to the default state (200ms).
- **Save:** the button shows a check (stroke-draw, reusing `check-draw`) for about 400ms, then
  the dialog closes. Closing reverses the open animation (160ms). Cards in the directory
  re-enter with the existing `rise-in` stagger.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, all of this becomes instant state
  changes (opacity only, ≤100ms), matching the existing reduced-motion block.

## Out of scope

- HR-defined custom fields; editing the employee form from HR.
- Removing other seeded data (payroll, leave, recruitment, cases…).
- Real file storage; uploads stay mock (names + data URLs in memory).

## Verification

No test runner exists. Verify with `npm run build` and `npm run lint`, then in the browser:
1. Employee: Onboarding shows four steps and no pop-up; upload two documents; submit → "Sent to HR".
2. HR: Pipeline lists the submission; Set up employment → toast with ID → View profile.
3. Directory: the person appears; documents show Submitted/Missing correctly.
4. Directory first visit opens Customize Directory; toggling/reordering updates the preview;
   Save changes cards and table; Reset restores defaults; reload keeps the choice.
5. Org Chart, Payroll, Manager team roster and Reports load without errors with an empty directory.
6. `/admin/onboarding` redirects to `/admin/pipeline`.
