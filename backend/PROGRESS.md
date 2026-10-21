# PROGRESS: MSMA HRIS sample

Resume point for any session: read this file and `CLAUDE.md`, then continue from the first unchecked phase.

## Phases

- [x] **Phase 1: Monorepo scaffold** (pnpm + Turborepo, docker-compose, env, docs, root scripts, placeholder API + web)
  - Run: `pnpm i` → `pnpm db:up` → `pnpm dev` (API http://localhost:4000/health + /docs, web http://localhost:3000).
    Mobile app is scaffolded in Phase 5.
- [x] **Phase 2: Database schema and synthetic seed**
  - Run: `pnpm db:up` → `pnpm db:migrate` → `pnpm --filter @msma/db seed` (prints row counts). From Phase 3 on use `pnpm db:seed`
    (seed + attendance recompute). Browse data: `pnpm --filter @msma/db studio`.
- [x] **Phase 3: API** (auth, attendance, devices/iclock, employees, approvals, dashboard, payroll, me)
  - Run: `pnpm db:seed` (seed + recompute) → `pnpm dev` → http://localhost:4000/docs. `pnpm simulate:punch [--count N | --every 20]`.
    Sample response: `docs/sample-dashboard-summary.json`. Unit tests: `pnpm --filter @msma/shared test`.
- [x] **Phase 4: Web HR dashboard**
  - Run: `pnpm dev` → http://localhost:3000, sign in as hr@msma.test / Demo@2026. Working: Dashboard (site filter, 6 KPIs,
    14-day trend, present by site, live punches every 10 s, approve/reject, payroll card, terminals), Employees (search,
    filters, pagination, CSV, 201 drawer), Approvals (tabs, type filter, reason dialog), Payroll (SAMPLE banner, cutoff/site,
    totals row, CSV, print), Settings (theme Light/Dark/Match my device, text size, density). Attendance/Leave/Reports = coming soon.
    After API changes run `pnpm openapi` to regenerate the typed client.
- [x] **Phase 5: Mobile app (Android + iOS)**
  - Run: `pnpm dev` (API) + `pnpm mobile` → press `a` (Android emulator) or scan the QR with Expo Go. Sign in as
    employee@msma.test / Demo@2026. Screens: Login, Home (today, clock in/out with selfie placeholder, balances, payslip),
    Attendance, Requests (+ File leave), Payslips, Profile (appearance, sign out).
  - Verified here: Android + iOS bundles compile (`expo export`), and on the Expo web preview: clock-in from the app showed
    in the web dashboard's live punches within 10 s; approving Jose's leave on the web flipped it to Approved on the phone
    within 10 s (and deducted 2 VL days). Not verified here (no emulator on this PC): an actual Android/iOS device run.
- [x] **Phase 6: Tests and quality**
  - Run: `pnpm test` (needs Docker DB) = 32 Vitest unit tests (DTR rules, payroll golden ₱ cases, money/time) + 17 API e2e
    tests (Supertest: login, dashboard summary, approve/reject + audit, /iclock) on the separate `msma_hris_test` database.
    `pnpm test:e2e` = Playwright (HR signs in → dashboard → approves a request) on its own ports 4100/3100 + test DB.
    `pnpm lint` (ESLint) and `pnpm format:check` (Prettier) are clean.
- [x] **Phase 7: Demo readiness**
  - README.md (Windows setup, logins, troubleshooting) and DEMO.md (5-minute script) written.
  - Clean-start check (fresh `git clone` → `pnpm bootstrap` → `pnpm dev` → `pnpm simulate:punch` → `pnpm test` → `pnpm lint`
    → `pnpm mobile`): all passed on 26 Sep 2026. Bootstrap took ~3 min.
- [x] **Phase 8: 201 file, plain-language UI, temporary online access** (28 Sep 2026)
  - Mobile sign-in fix: openapi-fetch rejected our middleware's returned Response on phones (Expo's fetch has its own
    Response class): "onResponse: must return new Response()". Middleware now returns nothing; regression-tested.
  - 201 file from the MSMA "201 File Checklist" (`docs/201-file-checklist.md`): 38 document types, checklist status
    (on file / expiring / expired / missing / only if applicable), uploads (PDF/JPG/PNG ≤ 8 MB), restricted records (HR only,
    every opening logged), archive-with-reason instead of delete, expiry suggestions, consent-first biometric enrollment,
    retention per type (SAMPLE), personal data sheet + dependents + government numbers (validated), effective-dated
    employment history. Seed: 3,820 sample documents with realistic gaps.
  - Web: dashboard "Things to do today"; employee page with tabs (Summary, 201 file, Personal info, Attendance & leave,
    Employment history); 201 files overview (tiles, filters, renewals due, most often missing, by site, CSV, print);
    grouped menu with "Soon" labels; Help & glossary. Mobile: "My 201 file" (what HR still needs, renew soon).
  - `pnpm share`: production copy on 4010/3010 + 8-digit access-code page + Cloudflare quick tunnel (`--lan` for the office
    network). Web calls the API through `/api` on the web server. Login throttling (5 wrong → 15 min), security headers.
  - Tests: 48 shared unit + 3 api-client + 31 API e2e (13 new for the 201 file, 1 for throttling). Verified here: all pages
    via the web proxy, uploads up to 8 MB through the proxy, `pnpm share --lan` end to end. **Not verified here:** the
    Cloudflare tunnel itself (`cloudflared` not installed on this PC) and the fixed app on a real phone.
- [x] **Phase 9: Development builds and desktop install** (28 Sep 2026)
  - EAS project `msma-solutions/msma-hris` (projectId in apps/mobile/app.json). `expo-dev-client`; profiles in
    `apps/mobile/eas.json`; variants in `apps/mobile/app.config.js` (dev = com.msma.hris.dev). Build servers use Node 24.21.0
    - pnpm 12.6.0; `eas-build-post-install` builds @msma/shared and @msma/api-client (their dist/ is not in git).
      Android keystore generated and stored by EAS. iOS device builds need the Apple Developer sign-in (user) and
      `eas device:create` per iPhone.
  - Windows/macOS: EAS/Expo cannot build desktop apps; the web dashboard is installable (manifest.ts, generated icons,
    Settings → Install on this computer).
- [x] **Phase 10: Phone clock-in with fingerprint / face / PIN (temporary)** (28 Sep 2026)
  - Replaces the selfie placeholder: `apps/mobile/src/lib/phone-check.ts` (expo-local-authentication) asks the phone's own
    lock; `POST /me/clock` now requires `phoneCheck` (PHONE_BIOMETRIC / PHONE_PASSCODE, new VerifyMode values, migration
    `20260928120000_phone_check`). `PHONE_CLOCK_ENABLED=false` turns it off (403). Biometrics never leave the phone.
  - Attendance machine evaluation (Deli E3765/ES161 is USB-only; recommend an ADMS push model): `docs/adr/0003-attendance-devices.md`.
  - Verified: 35 API e2e (2 new), 48 shared, 3 api-client tests; typecheck, lint; iOS + Android bundles export; live
    clock-in through the Expo proxy. Not verified here: the fingerprint/Face ID prompt on a real phone.
  - Needs a new EAS dev build for Face ID on iPhone (plugin adds NSFaceIDUsageDescription); Expo Go works now (may fall back
    to the passcode on iPhone).

- [x] **Phase 11: Overtime, undertime and time adjustment requests; Leave page** (28 Sep 2026)
  - Employees file overtime (`POST /me/overtime-requests`), undertime (`/me/undertime-requests`, new `UndertimeRequest`
    model + `UNDERTIME` approval type, migration `20260928140000_undertime_requests`) and time adjustments
    (`/me/time-adjustments`, stored as `DtrCorrection`). Up to 30 days back (overtime/undertime also 30 days ahead); one
    pending request of a kind per day; every filing audited (OT_SUBMITTED, UNDERTIME_SUBMITTED, DTR_FIX_SUBMITTED).
  - Mobile: Requests tab → "File a request" (Leave, Overtime, Undertime, Time adjustment), day chips and −/+ steppers
    (`apps/mobile/src/components/form.tsx`). Web: "My requests" page for staff linked to an employee; "Leave" page for
    HR/managers (`GET /leave/overview`: away in the next 30 days, days left, CSV).
  - Rules: payroll pays overtime only when approved, capped at the clocked overtime; approved undertime stays unpaid and
    shows "undertime approved" on the DTR; an approved time adjustment replaces that day's time in / time out (raw
    punches are kept, only no longer counted for that day).
  - Verified: 40 API e2e (5 new), 51 shared (3 new), 3 api-client; typecheck, lint, format; iOS + Android bundles; web
    Leave and My requests pages in the browser (HR). Fixed during testing: the HH:mm time check rejected every time, and a
    time adjustment could not correct a wrong (not missing) time out.

**Next (see `docs/hris-scope.md`):** Phase 12 schedules and
pay rules → 13 payroll run and register → 14 BIR and government outputs → 15 privacy pack → 16 go-live.

## Status after Phase 7

**Works (real data flow):** login with roles; dashboard (KPIs, site filter, 14-day trend, present by site, live punches every
10 s, terminal status, payroll card); employees 201 list + drawer; approvals with audit log; sample payroll preview with CSV
and print; appearance settings; ZKTeco ADMS `/iclock` push + `pnpm simulate:punch`; DTR engine (late/grace, undertime, OT,
night diff, holidays, rest days, leave, corrections); mobile clock in/out, leave filing, requests, attendance, payslip.

**Placeholder / sample only:** GPS/geofence on mobile (phone clock-in is temporary, see ADR-0003); payroll statutory rates (unverified) and run workflow
(Reviewed/Approved/Locked are display only); Attendance, Leave and Reports pages on the web ("coming soon"); File OT and
DTR correction from mobile (seeded requests only); 2026 holiday list (approximate); fonts on mobile (system font).

**Top 5 gaps before real development** (Phase 8 closed: 201 editing, login rate limiting; see also `docs/deploy-aws.md`):

1. **Payroll correctness:** verify SSS/PhilHealth/Pag-IBIG/BIR tables with accounting; pay only approved OT; rest-day and
   holiday OT multipliers; 13th month, allowances, loans and adjustments; a real run lifecycle (lock, approve, release),
   payslip PDFs and government remittance files.
2. **Security and Data Privacy Act (RA 10173):** httpOnly-cookie sessions or Better Auth with refresh tokens and MFA for
   admins, login rate limiting, encrypted government IDs, audit log on every write, HTTPS, VPN/IP allow-list for terminals,
   NPC registration and a privacy notice.
3. **Real devices:** test with the actual ZKTeco terminals (firmware differences, clock drift, offline buffering, user/PIN
   sync) and choose the machine model (ADR-0003: ADMS push, not USB-only).
4. **Production operations:** hosting (one cloud server with Docker is the recommended start), daily backups with a tested
   restore, monitoring, CI/CD, EAS builds for Google Play internal testing and TestFlight.
5. **Missing HR features and data migration:** shift scheduling (night/flexi shifts), leave policies and accruals, 201
   editing and onboarding, the Attendance/Leave/Reports screens, notifications, and importing real employee data from the
   current Excel/system.

## Decisions and notes

- Versions pinned for stability (Sep 2026): NestJS 11 (as specified; 12 exists), Prisma 6.19 (7/8 change the client/ESM model),
  TypeScript 5.9 (TS 7 native compiler breaks Nest CLI tooling), Next.js 16, React 19.2.3 (same version as Expo SDK 57 so web
  and mobile share one React), Tailwind 4, Zod 4, Vitest 4.
- pnpm uses `nodeLinker: hoisted` (flat node_modules) because Expo/Metro is most reliable that way.
- `pnpm setup` is a built-in pnpm command, so the one-step setup script is **`pnpm bootstrap`**.
- Passwords use `bcryptjs` (pure-JS bcrypt, no native build on Windows).
- Asia/Manila is a fixed UTC+8 (no DST), so time helpers use a fixed offset; deterministic everywhere.
- Shared pure calculations (DTR, payroll) live in `packages/shared` so the seed, API and tests use one implementation.
- Seed: deterministic random seed, dates relative to now (override with `SEED_NOW`). 180 employees (HQ 96, Mandaue 48,
  Lapu-Lapu 36), 14 working days of punches (~8% late, ~3% absent, ~1% missing time-out, ~10% OT; warehouse OT sometimes
  past 22:00 for night differential), 9 pending approvals, a RELEASED payroll run for the previous cutoff (latest payslip).
  Jose Reyes has no punch today so the demo can clock him in from the phone. Lapu-Lapu terminal starts "offline".
- `RawPunch` is append-only via a Postgres trigger (UPDATE/DELETE raise an error). Mobile punches use deviceSerial `MOBILE-APP`.
- Employee has `biometricPin` (what ZKTeco terminals send as PIN). Leads have no manager; Mandaue and Lapu-Lapu staff report to
  their branch manager; HQ staff report to their department lead. manager@msma.test = Carlo Dizon (Mandaue branch manager).
- 2026 holidays are approximate (Eid dates especially). Verify against the official proclamation.
- API module graph (no cycles): employees ← leave ← attendance ← {devices, approvals, payroll} ← dashboard; `me` and
  `EmployeesHttpModule` are HTTP-only composition modules. RawPunch, DTR, holidays, OT requests and DTR corrections belong
  to attendance; Device to devices; leave tables to leave; approvals orchestrate decisions and write AuditLog.
- OT rule: minutes beyond 8 worked hours, counted only when the excess is ≥ 30 min (`otMinimumMinutes`), because otherwise
  every 17:10 time-out becomes 10 min of OT. Work counts from shift start (arriving early is not OT). Payroll uses DTR OT
  minutes; real payroll should only pay _approved_ OT (gap).
- DTR for "today" is ABSENT until the first punch; `/dashboard/summary` recomputes a day that has no DTRs yet (new day).
- Managers: approvals + employees limited to direct reports, dashboard limited to their site, payroll card hidden,
  government IDs masked. Nobody can decide their own request. Clock-in debounce is 60 s.
- `/iclock/*` is public (terminals cannot send JWTs) but only accepts registered serials. Production: VPN / IP allow-list.
- Payroll preview: basic = daily rate × paid days (present + paid leave + unworked regular holiday), OT +25%, ND +10%,
  regular holiday worked 200%, special worked +30%, late/undertime deducted per minute; SSS/PhilHealth/Pag-IBIG on the
  monthly equivalent (daily × 313 / 12) split per semi-monthly cutoff; TRAIN semi-monthly tax table. Pay date = cutoff end + 5 days.
- Web: shadcn/ui-style components are hand-written in `apps/web/src/components/ui` (same Radix + cva + tailwind-merge
  pattern shadcn generates; the shadcn CLI is interactive). Selects are native `<select>` for accessibility. Auth token is in
  localStorage (sample only; production should use httpOnly cookies). Appearance is cached in localStorage and applied by
  an inline script before paint. Employee role gets a "please use the mobile app" screen on the web.
- The API re-reads the user on every request, so tokens from before a reseed get 401 → login screen.
- Mobile API URL: `EXPO_PUBLIC_API_URL` (apps/mobile/.env) wins; otherwise the app calls `<Expo dev server address>/__api`,
  which Metro forwards to the API (`apps/mobile/metro.config.js`), so any Wi-Fi and `pnpm mobile:tunnel` work with one port.
  Token in expo-secure-store. Requests/leave balances poll every 10 s. Mobile theme default = Match my device.
  Mobile uses the system font (IBM Plex not bundled) with tabular monospace numbers. `react-native-web` is included only
  for the browser preview. Expo SDK 57 prefers TypeScript 6, so the mobile app uses TS ~6.0 (the rest uses 5.9).
- Payroll money math multiplies before dividing (daily × minutes × rate / 480) so half-centavo amounts round correctly;
  a golden test caught 71.875 → 71.87 when dividing first.
- Test database is prepared with `prisma migrate deploy` + seed (the seed truncates tables). `prisma migrate reset` is not
  used: Prisma blocks it for AI agents, and it isn't needed. `pnpm db:reset` = migrate + seed.
- `packages/db` build only runs `prisma generate` when the schema changed (Windows locks the engine DLL while the API runs).
- Typed API client lives in `packages/api-client` (openapi-typescript + openapi-fetch), shared by web and mobile.
- Web → API goes through the Next.js server (`/api/*` rewrite, `API_INTERNAL_URL`), so browsers need one address. An old
  `NEXT_PUBLIC_API_URL=http://localhost:4000` in .env is ignored on purpose.
- 201 access classes: GENERAL (HR, System Admin, the employee), PAYROLL (+ Payroll), PERFORMANCE (HR, direct manager,
  employee), RESTRICTED and HEALTH (HR only). Payroll can upload/edit PAYROLL types and government numbers only.
- Seed 201 data uses its own random generator (`prisma/seed-201.ts`), so the rest of the seed and its tests are unchanged.
  Jose Reyes: NBI clearance expiring in ~18 days, medical results and handbook acknowledgment missing (mobile demo).
  7 employees are on the time clocks without a consent form on file (shows the consent-first warning).
- Document files: `storage/documents` (gitignored; tests use `storage/test-documents`). `DOCUMENT_STORAGE_DIR` overrides.
