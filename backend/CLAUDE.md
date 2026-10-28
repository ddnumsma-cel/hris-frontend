# CLAUDE.md: MSMA HRIS

Internal HR system sample for MSMA Solutions (Cebu City, PH; ~180 employees, 3 sites).
Everything runs locally. **Synthetic data only: never real employee data.**
Progress and the resume point live in `PROGRESS.md`. Read it first.

## Layout

- `apps/api`: NestJS 11 REST API, port 4000, Swagger at `/docs` (JSON at `/docs-json`)
- `apps/web`: Next.js App Router + Tailwind + shadcn-style components + TanStack Query + Recharts, port 3000
- `apps/mobile`: Expo (SDK 57) + Expo Router + TanStack Query (Android first, then iOS via Expo Go)
- `packages/db`: Prisma 6 + PostgreSQL 16 (schema, migrations, synthetic seed)
- `packages/shared`: Zod schemas, shared types, PHP money + Asia/Manila date helpers, pure HR calculations
- `packages/api-client`: typed client generated from the API's OpenAPI spec (web + mobile use it; no hand-written fetch)
- `docs/`: `hris-scope.md` (what to build to replace Xeleqt, legal must-haves, build order), `201-file-checklist.md` (the 201 data dictionary), `adr/` (decisions), `deploy-aws.md` (cloud plan)

## Rules

- **Currency is Philippine peso.** Money = Prisma `Decimal` / `NUMERIC(14,2)` in the DB and `decimal.js` in code, never JS floats.
  APIs return money as decimal strings ("14862.50"). Display only with `formatPHP()` from `@msma/shared`
  (Intl.NumberFormat 'en-PH' PHP), e.g. ₱14,862.50.
- **Time:** store UTC; compute and display in Asia/Manila using `@msma/shared` time helpers.
  Dates display like "25 Sep 2026" (`formatDate`). Calendar dates (DTR date, leave dates) are `@db.Date` holding the Manila date.
- **API modules:** auth, employees, documents (201 file), attendance, devices, leave, approvals, payroll, dashboard (+ me, prisma, audit).
  Modules talk only through exported services, never another module's controller or Prisma queries for another module's tables.
- Every endpoint: validated with Zod (`ZodBody`/`ZodQuery` pipes, schemas in `@msma/shared`), documented in Swagger,
  protected by the global JWT guard + `@Roles(...)`. Public endpoints are marked `@Public()` explicitly.
- **Roles:** EMPLOYEE, MANAGER, HR_ADMIN, PAYROLL_ADMIN, SYSTEM_ADMIN.
- Every approval decision writes an `AuditLog` row.
- Auth sits behind the `AuthService` interface (`apps/api/src/auth/auth.service.ts`) so Better Auth can replace it later.
- **201 file** (source: the MSMA "201 File Checklist", copied in `docs/201-file-checklist.md`): the document catalog, access
  rules and checklist status live in `packages/shared/src/records201.ts`. Add or change document types there (and in the
  Prisma `DocumentType` enum), never ad hoc in a screen. Files go through `DocumentStorage` (local disk now, S3 later),
  keyed by server-generated names; only PDF/JPG/PNG (checked by content), max 8 MB.
- **Restricted records** (IDs, medical, disciplinary, termination): HR only. Every opening, upload, change and removal of a
  document writes an `AuditLog` row. Documents are never hard-deleted by the app; removal archives with a reason.
- **Attendance sources:** office machines push punches over ZKTeco ADMS (`/iclock`). Phone clock-in is temporary
  (`PHONE_CLOCK_ENABLED`): the phone's own lock (fingerprint / face / PIN) confirms the employee on the phone, and only
  the result (`PHONE_BIOMETRIC` / `PHONE_PASSCODE`) reaches the API. See `docs/adr/0003-attendance-devices.md`.
- **Consent first:** no biometric enrollment without the signed biometric consent on file (the API returns 409).
- Retention periods are SAMPLE values (`RETENTION_VERIFIED = false`) until the Firm confirms them.
- Payroll is a **SAMPLE**. Statutory rates are approximate and flagged `"verified": false`. Always show the "SAMPLE" banner.
- **No secrets in git:** commit `.env.example` only. Never print or read `.env` contents in chat.
- **Encrypted numbers:** TIN, SSS, PhilHealth, Pag-IBIG and bank account numbers are stored encrypted (`packages/db/src/sealed.ts`)
  with `HRIS_DATA_KEY` in `backend/.env`. A fresh copy needs nothing: the API (or `pnpm db:seed`) creates the key on first start
  while the database holds no encrypted numbers (`ensureDataKey`). If it says the key is missing but encrypted numbers exist, put
  the original key back; never generate a new one, never copy another machine's key, never commit or print it. Live servers
  (`NODE_ENV=production`) must set it on purpose. Read and write these fields only through `seal`/`unseal`.
- Keep scripts cross-platform (Windows cmd/PowerShell + macOS/Linux): pnpm scripts and Node, no bash-only commands.

## UI and design decisions

- Colours (light / dark): bg #F6F5F1 / #111315, card #FFFFFF / #1B1D1F, sidebar #1B1D1F / #0B0C0D,
  text #1B1D1F / #ECEAE4, muted #5F6368 / #A1A4A8, border #E4E2DC / #2C2F33, teal #0E6B63 / #3DB5A8,
  green #067647 / #47CD89, amber (late) #B45309 / #F5A524, red (absent) #B42318 / #F97066.
  Tokens live in `packages/shared/src/theme.ts` and as CSS variables in `apps/web/src/app/globals.css`.
- Fonts: IBM Plex Sans (text), IBM Plex Mono (numbers, tabular, right-aligned).
- Theme setting: Light / Dark / "Match my device". Web default Light; mobile default Match my device.
  Saved per user (`PATCH /me/preferences`) with textSize (STANDARD/LARGE) and tableDensity (COMFORTABLE/COMPACT).
- Status badges always show text + colour. Confirm dialogs state the exact effect. Tables offer CSV export and print.
- Plain HR language familiar in PH (201 file, DTR, cutoff, SIL); avoid tech jargon in the UI.
- **Users are HR staff, lawyers and accountants, not IT people.** Every screen answers "what do I need to do?" first:
  the dashboard starts with "Things to do today" (one sentence + one button per item); lists default to what needs
  attention; each 201 item has a one-line explanation. Spell out abbreviations in tables (Undertime, not UT). Error
  messages say what to do next. New terms go in the Help & glossary page (`apps/web/src/app/(app)/help/page.tsx`).
- Pages that are not built yet are labelled "Soon" in the menu.

## Commands

`pnpm bootstrap` (first run) · `pnpm db:up` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:reset` · `pnpm dev` ·
`pnpm mobile` · `pnpm share` (temporary online link) · `pnpm simulate:punch` · `pnpm openapi` (regenerate typed client) · `pnpm test` · `pnpm test:e2e` · `pnpm lint`

## Working agreement

End each phase by running the relevant build/tests, fixing errors, ticking `PROGRESS.md`, then committing `phase N: <summary>`.
