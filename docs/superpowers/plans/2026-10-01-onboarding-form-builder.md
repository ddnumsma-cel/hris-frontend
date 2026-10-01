# HR-built onboarding form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HR builds the Onboarding form with drag and drop; employees see only that form.

**Architecture:** A field catalog + `OnboardingFormConfig` (`src/lib/onboardingForm.ts`) persisted via `api.ts` in localStorage. The employee page derives steps, validation and review from the config and renders fields through one renderer map. The HR builder edits the config; the Directory hosts the prompt and the Edit form entry.

**Tech Stack:** React 19, TS, react-hook-form + zod, TanStack Query, Tailwind v4, native HTML5 drag and drop, WAAPI FLIP.

**Spec:** `docs/superpowers/specs/2026-10-01-onboarding-form-builder-design.md`

## Global Constraints

- Gate per task: `npm run build` + `npm run lint`; final browser walk (headless Edge driver in scratchpad).
- No new dependencies. localStorage access in try/catch. Motion respects reduced motion.
- Commit locally after each task; never push.

## Review Focus

- Config saved with unknown field/section keys (or locked ones missing) must load repaired, not crash.
- A draft saved against an older form must load when HR has since removed fields.
- Required-by-HR composite fields (address, emergency, dependents) validate and clear correctly.
- Hidden (not-in-form) fields never block submit, e.g. a stale emergency phone format error.
- Drag and drop must have a keyboard path (Add / up / down / remove).

---

### Task 1: Form model + storage
Create `src/lib/onboardingForm.ts` (catalog, `FormConfig`, `normalizeConfig`, `valueNamesOf`, `defaultConfig`), add `fetchOnboardingForm` / `saveOnboardingForm` to `api.ts`, extract `useFlip` to `src/lib/useFlip.ts`. Build, commit.

### Task 2: Employee Onboarding driven by the config
Create `onboarding/FormFields.tsx` (renderer per field + `FormSection`), rewrite `model.ts` steps/resolver/required from config, rewrite `ReviewStep`, update `OnboardingPage` (empty state, dynamic steps), delete `IdentityStep.tsx` / `ContactStep.tsx`, drop work background. Build, commit.

### Task 3: HR builder, prompt, live dialog; remove Customize Directory
Create `admin/onboardingForm/FormSetupPrompt.tsx`, `FormBuilderDialog.tsx`, `FormLiveDialog.tsx`; wire into `AdminPersonnelFiles`; delete `CustomizeDirectoryDialog.tsx` and directory storage; CSS for builder motion; BACKEND_HANDOFF note. Build, commit.

### Task 4: Browser verification + review
Drive the flow; fix findings; whole-branch review; fix Important; commit.
