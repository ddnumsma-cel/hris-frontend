# HR-built onboarding form — design

Date: 2026-10-01 · Branch: `feature/add-employee-id-uploads` · Supersedes the "Customize Directory"
part of `2026-10-01-pipeline-directory-customize-design.md` (Pipeline and uploads stay).

## Intent

Companies need different information from new hires. HR builds the Onboarding form; that exact
form is what employees fill in. Until HR builds it, employees have no form.

## Employee Onboarding

- **No form yet:** empty state — "HR is preparing your onboarding form. You'll be able to fill it
  in here once it's ready." No steps, no fields.
- **Form saved:** one step per HR section (in HR's order), then **Gov't IDs & 201 files**
  (always), then **Review**. Fields and their required flags follow HR's form. Edits HR makes show
  up on the next render (shared query + `storage` event across tabs).
- Submitting is unchanged: the submission waits in Pipeline.

## Field library (ready-made only; no custom questions, no work background)

| Section | Locked (always in, always required) | Optional fields HR can add |
|---|---|---|
| Personal details | Legal name (last, first), Birth date, Sex | Middle name, Suffix, Civil status (spouse when Married), Blood type |
| Contact | Mobile | Personal email, Work email |
| Home address | — | Home address (street, barangay, city, province) |
| Emergency contact | — | Emergency contact (name, relationship, mobile) |
| Family | — | Children & dependents |

Gov't numbers and 201 files are a fixed final step, shown in the builder as a locked card.
Personal details and Contact sections can't be removed (they hold locked fields).

## HR: Employee Directory

- While no form exists, opening the Directory shows a centered pop-up (Image 2 style): illustration,
  **"Set up your onboarding form"**, "Choose what new hires fill in. You can change it anytime.",
  **Not now** / **Start customizing form**. Not now hides it until the next visit.
- Header action: **Edit form** once a form exists, **Set up onboarding form** before.
- "Customize directory" display settings are removed; cards and table show fixed details
  (department, office & cluster, work email, mobile, date hired, 201 files).

## Form builder (full-screen dialog)

- **Left — field library:** fields not in the form, grouped by section. Drag onto the form, or
  press **Add**.
- **Center — your form:** section cards in order. Drag a section by its handle to reorder; drag
  fields within a section to reorder. Each field: drag handle, label, hint, **Required** switch,
  remove (×). Locked fields show a lock and "Always required". Up/down buttons mirror dragging for
  keyboard and touch. A field always lives in its own section; dropping it elsewhere adds it to its
  section. Final locked card: "Gov't numbers & 201 files · Always included".
- **Preview** toggle shows the form exactly as employees see it (disabled inputs).
- **Footer:** Cancel · Save form. Save publishes, closes the builder and opens "Your onboarding
  form is live" with **Edit form** and **Back to directory**.
- **Motion:** the dragged item fades/lifts; a brand drop line shows the landing spot; siblings
  slide (FLIP) on drop/reorder; added fields fade in; pop-ups scale in. Instant with reduced motion.

## Storage

`OnboardingFormConfig { sections: { key, fields: { key, required }[] }[]; updatedAt }` stored in
`localStorage` (`msma-onboarding-form`) behind `fetchOnboardingForm` / `saveOnboardingForm` in
`api.ts`, so it survives reloads and both roles read the same copy. Noted in BACKEND_HANDOFF.

## Verification

Build + lint; browser: HR pop-up → build form by dragging → save → live dialog; employee sees
those steps/required fields and submits; HR edits form → employee side updates; employee with no
form sees the empty state.
