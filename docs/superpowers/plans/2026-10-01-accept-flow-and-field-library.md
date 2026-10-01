# Accept flow, address dropdowns, bigger field library — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HR accepts submissions from the Directory; Pipeline shows hired / not yet hired; richer form fields; PSGC address dropdowns; Onboarding hides after submit.

**Architecture:** Generic `extras` values for new fields rendered by field kind; a PSGC loader + `AddressFields` component; a shared `ReviewSubmissionDialog`; localStorage persistence inside mockData setters.

**Tech Stack:** React 19, TS, react-hook-form + zod, TanStack Query, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-01-accept-flow-and-field-library-design.md`

## Global Constraints
- Gate: `npm run build` + `npm run lint`; browser walk at the end. No new dependencies. Commit per task, never push.

## Review Focus
- Saved forms with the old `emergency`/`family` sections load migrated, not broken.
- Old drafts with free-text barangay/city values still display (not silently lost).
- Persisted mock state that is corrupt or from an older shape must not crash startup.
- An employee who submitted must not be able to reach the form again, but must still see the success screen once.
- Extras paths (`extras.x`) validate, clear and show in Review and the HR dialog.

### Task 1: PSGC data + AddressFields
### Task 2: Field catalog, extras, emergency move, family removal
### Task 3: Persistence, hired records, Onboarding hidden after submit
### Task 4: ReviewSubmissionDialog, Directory inbox, Pipeline lists
### Task 5: Browser walk + review
