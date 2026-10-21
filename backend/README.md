# MSMA HRIS (working sample)

A working sample of an internal HR system for MSMA Solutions (Cebu City, 3 sites, ~180 employees).
Everything runs on one Windows PC with **synthetic data only**.

```
 Biometric terminals ──(ZKTeco ADMS push)──┐
 Employees' phones  ──(Expo app)───────────┼──►  API (NestJS, :4000)  ──►  PostgreSQL 16 (Docker, :5432)
 HR / Payroll / Managers ──(web, :3000)────┘
```

| Part         | Folder                | What it is                                                                    |
| ------------ | --------------------- | ----------------------------------------------------------------------------- |
| API          | `apps/api`            | NestJS 11 REST API. Swagger docs at http://localhost:4000/docs                |
| Web          | `apps/web`            | HR dashboard (Next.js). http://localhost:3000                                 |
| Mobile       | `apps/mobile`         | Employee app for Android and iOS (Expo)                                       |
| Database     | `packages/db`         | Prisma schema, migrations and the synthetic seed                              |
| Shared       | `packages/shared`     | ₱ money + Asia/Manila date helpers, DTR and payroll calculations, API schemas |
| Typed client | `packages/api-client` | API client generated from the Swagger spec, used by web and mobile            |

> **Payroll is a SAMPLE.** SSS, PhilHealth, Pag-IBIG and withholding tax tables are approximate and marked
> "not verified". Do not use the numbers for real pay.

---

## 1. Install the tools (once)

1. **Node.js 22 or newer** (LTS): https://nodejs.org
2. **pnpm**: open a new Command Prompt and run `npm i -g pnpm`
3. **Git**: https://git-scm.com
4. **Docker Desktop**: https://www.docker.com/products/docker-desktop. It needs WSL 2: in PowerShell **as Administrator**
   run `wsl --install`, restart the PC, then open Docker Desktop and wait for **"Engine running"**.
5. **For the mobile app**, pick one:
   - the **Expo Go** app on your Android phone (Play Store) or iPhone (App Store), with the phone on the **same Wi-Fi** as the PC, or
   - **Android Studio** with a virtual device (More Actions → Virtual Device Manager → Create device, then press ▶).

Close and reopen Command Prompt after installing, then check: `node -v`, `pnpm -v`, `docker --version`.

## 2. First-time setup

Open **Command Prompt** in the project folder (for example `C:\Users\ADMIN\msma-hris`) with Docker Desktop running:

```bat
pnpm bootstrap
```

That one command does all of this (you can also run the steps yourself):

```bat
copy .env.example .env
copy apps\mobile\.env.example apps\mobile\.env
pnpm i
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

`pnpm db:seed` loads 180 fake employees, 14 working days of punches, leave, 9 pending approvals and last cutoff's payslips,
then prints a row count per table.

## 3. Run it

```bat
pnpm dev
```

- Web dashboard: **http://localhost:3000**
- API documentation (Swagger): **http://localhost:4000/docs**

**Demo logins** (password for all: `Demo@2026`):

| Email                | Role          | Who                                 | Use on |
| -------------------- | ------------- | ----------------------------------- | ------ |
| `hr@msma.test`       | HR Admin      | Princess Alcantara (HQ)             | Web    |
| `payroll@msma.test`  | Payroll Admin | Liza Mercado (HQ)                   | Web    |
| `manager@msma.test`  | Manager       | Carlo Dizon, Mandaue branch manager | Web    |
| `employee@msma.test` | Employee      | Jose Reyes, Mandaue                 | Mobile |

Fake a fingerprint punch from a terminal (in a second Command Prompt):

```bat
pnpm simulate:punch
```

Use `pnpm simulate:punch --count 5` for five, or `pnpm simulate:punch --every 20` to keep punching every 20 seconds
(also keeps the terminals "online"; Ctrl+C to stop).

## 4. The mobile app

With `pnpm dev` running, open a second Command Prompt:

```bat
pnpm mobile
```

Always start the app this way from the project folder. **Do not run `npx expo start` in the project root**: that is not
the app and gives "Unable to resolve ../../App". (Inside `apps\mobile`, `npx expo start` is fine.)

Before starting Expo, `pnpm mobile` prints the network address it uses, the Wi-Fi name your phone must join, and a link to
test from the phone's browser. It picks your real Wi-Fi/Ethernet address and skips virtual adapters (WSL, Docker,
Hyper-V, VirtualBox, VPNs), which often have a similar-looking IP that the phone can't reach.

- **Phone with Expo Go**: scan the QR code (Android: in Expo Go; iPhone: with the Camera app), or in Expo Go tap
  **Enter URL manually** and type the `exp://…` address that `pnpm mobile` printed.
- **Android emulator**: start the virtual device in Android Studio first, then press **`a`** in the Expo window.
- **iOS simulator** (Mac only): press **`i`**.

Sign in as `employee@msma.test` / `Demo@2026`. The login screen shows the server address and has a **Test connection**
button.

**How the phone reaches the API:** through the Expo dev server itself. The app calls `<the address it was loaded
from>/__api/…` and the dev server passes that to the API on your PC. So if the app loads, the API works, with no second
port to open. Leave `apps\mobile\.env` empty (the default) for this.

**Changing Wi-Fi:** leave `pnpm mobile` running. It checks the network every few seconds. When your PC gets a new
address, it restarts Expo and prints a new QR code. On the phone, join the same Wi-Fi and scan the new QR code.

| Situation                                                                   | Command                                         |
| --------------------------------------------------------------------------- | ----------------------------------------------- |
| Normal start (phone and PC on the same Wi-Fi)                               | `pnpm mobile`                                   |
| **Anywhere**: different networks, mobile data, or Wi-Fi that blocks devices | `pnpm mobile:tunnel`                            |
| Strange errors after changes                                                | `pnpm mobile:clear` (clears the Expo cache)     |
| It picked the wrong address                                                 | `pnpm mobile --ip 192.168.1.25` (your Wi-Fi IP) |

`pnpm mobile:tunnel` gives the dev server a public `https://…exp.direct` address through Expo's tunnel. The phone only
needs internet, and the address stays the same when you change Wi-Fi. It is slower than Wi-Fi, needs internet on both
the PC and the phone, and anyone with the QR code can open the app while it runs, so use it only with synthetic data.

Expo Go's "Development servers" list only shows your PC if the Expo CLI and Expo Go are signed in to the same Expo
account (`npx expo login --browser`). This is optional: scanning the QR code always works.

**Requests:** on the phone open **Requests → File a request**: Leave, Overtime (paid only after approval), Undertime
(leave before the shift ends) or Time adjustment (a missing or wrong time in / out). Staff who use the web file theirs on
**My requests**. Managers and HR decide in **Approvals**; HR and managers see who is away on **Leave**.

**Clocking in (temporary, until the attendance machines arrive):** on the phone tap **Clock in**. The phone asks for its
own fingerprint, face (Face ID / face unlock) or PIN, the same way it unlocks. The fingerprint and face never leave the
phone; the dashboard's Live punches show "Phone (fingerprint / face)" or "Phone (PIN / password)". A phone without a
screen lock cannot clock in. In Expo Go on an iPhone, Face ID may not appear, so the phone asks for its passcode instead
(the dev build shows Face ID). To turn phone clock-in off later, set `PHONE_CLOCK_ENABLED=false` in `.env` and restart
the API. Choosing the office machine: see `docs/adr/0003-attendance-devices.md`.

To point the app at a different API (for example a deployed test server), set `EXPO_PUBLIC_API_URL` in
`apps\mobile\.env` and restart `pnpm mobile`.

### Development build (instead of Expo Go)

The project has a **development build**: our own "MSMA HRIS (Dev)" app, built in the cloud with EAS under the
**msma-solutions** Expo organization. It works like Expo Go (connects to `pnpm mobile`, reloads when code changes) but
is not tied to Expo Go's SDK version and can use any native module. It installs next to the real app
(`com.msma.hris.dev`).

- **Android:** open the build page on expo.dev (link from `pnpm build:dev:android`, or expo.dev → msma-solutions →
  msma-hris → Builds), scan its QR code with the phone and install the APK (allow "Install unknown apps" once).
- **iPhone without an Apple Developer account:** use **Expo Go** instead of the dev build. The iPhone owner installs
  Expo Go from the App Store (with their own Apple ID), then you run `pnpm mobile:go` (same Wi-Fi) or
  `pnpm mobile:go --tunnel` (any network) and they scan the QR code with the **Camera** app. Tap **Allow** when iOS asks
  to find devices on the local network.
- **iPhone dev build** (needs the paid Apple Developer account), in Command Prompt in the project folder:
  ```bat
  cd apps\mobile
  npx eas-cli device:create
  npx eas-cli build --platform ios --profile development
  ```
  `device:create` gives a link/QR to open **on the iPhone** to register it. The build asks you to sign in to Apple (only
  you can do that) and creates the certificates. Install from the build page, then on the iPhone turn on Settings →
  Privacy & Security → **Developer Mode**. Each new iPhone must be registered, then build again.
- **Daily use:** `pnpm dev` + `pnpm mobile`, then open **MSMA HRIS (Dev)** on the phone and pick the server, or scan the
  QR code. `pnpm mobile:go` starts in Expo Go mode instead.
- **Build again only** when native things change (a new native package, app icon, permissions, `app.json` plugins).
  Screen and logic changes arrive through `pnpm mobile` like before.
- Other profiles in `apps/mobile/eas.json`: `development-simulator` (iOS Simulator on a Mac), `preview` (internal test
  app without the dev menu; set `EXPO_PUBLIC_API_URL` for it on expo.dev → Environment variables), `production` (stores).

### Windows and macOS

EAS and Expo build Android and iOS apps only. On computers, staff use the **web dashboard as an installed app**: open
it in Chrome or Edge (Windows or Mac) → **Settings → Install on this computer** (or the install icon in the address
bar); in Safari on a Mac use File → **Add to Dock**. It opens in its own window with a Start menu / Dock icon and updates
itself. Installing needs https (e.g. the `pnpm share` link or, later, the AWS address) or `localhost`.

## 5. Let colleagues try it online (temporary, before AWS)

Your laptop can put a copy of the system on the internet for a few hours, for demos and user testing with the
**sample data only**. Colleagues open a link in their browser; nothing is installed on their side.

**Once:** install Cloudflare's free tunnel tool, then close and reopen Command Prompt:

```bat
winget install --id Cloudflare.cloudflared
```

**Each time** (Docker Desktop running, `pnpm db:up` done; `pnpm dev` may keep running):

```bat
pnpm share
```

After 1–3 minutes it prints a box like this:

```
  Link:              https://quiet-river-1234.trycloudflare.com
  Access code:       4821-7730
```

- Send the **link** and the **access code** separately (e.g. link by e-mail, code by phone or SMS). The page asks for the
  code first, then the normal sign-in (`hr@msma.test` / `Demo@2026` etc.).
- Keep the window open and the laptop **awake and online** (Settings → System → Power: set sleep to "Never" while sharing).
- **Ctrl+C** takes it offline. The link and code change every time; old sign-ins stop working.
- Only colleagues in the same office/Wi-Fi? `pnpm share --lan` (no tunnel needed; prints `http://<this PC>:3020`).
- Phone app for testers elsewhere: `pnpm mobile:tunnel` in another window.

This is not the production setup: real employee data goes on AWS only (plan: `docs/deploy-aws.md`, decision:
`docs/adr/0002-temporary-online-access.md`).

## 6. The 201 file

Each employee's record (Employees → click a name) has a **201 file** tab built from the MSMA 201 File Checklist
(`docs/201-file-checklist.md`): what is on file, missing, expiring or expired, with **Upload** buttons. The **201 files**
page lists everyone who still needs documents; the dashboard's **Things to do today** shows renewals due.

- Scans: PDF, JPG or PNG, up to 8 MB. They are saved in `storagedocuments` in the project folder (never committed to git).
  Back up that folder together with the database.
- Restricted records (IDs, medical, disciplinary) open for HR only, and every opening is logged ("Who opened" icon).
- "Remove" keeps the file in the archive with the reason; nothing is permanently deleted from the app.
- Retention periods are sample values until the Firm confirms them.

## 7. Everyday commands

| Command                         | What it does                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm db:up`                    | Start PostgreSQL in Docker                                                           |
| `pnpm db:down`                  | Stop it (data is kept)                                                               |
| `pnpm db:seed`                  | **Reset the demo data** (wipes and reloads synthetic data). Do this before each demo |
| `pnpm db:reset`                 | Apply migrations, then reset the demo data                                           |
| `pnpm dev`                      | Start the API and the web dashboard                                                  |
| `pnpm mobile`                   | Start the Expo dev server for the phone app (`pnpm mobile:clear` clears its cache)   |
| `pnpm share`                    | Temporary online link for colleagues (see section 5; `--lan` for the office only)    |
| `pnpm simulate:punch`           | Send a fake biometric punch                                                          |
| `pnpm test`                     | Unit tests + API end-to-end tests (uses a separate test database)                    |
| `pnpm test:e2e`                 | Browser test (Playwright): HR signs in and approves a request                        |
| `pnpm lint` / `pnpm format`     | Code checks / formatting                                                             |
| `pnpm openapi`                  | Regenerate the typed API client after changing the API                               |
| `pnpm --filter @msma/db studio` | Browse the database in Prisma Studio                                                 |

After the first setup, a normal day is: open Docker Desktop, then `pnpm db:up`, then `pnpm dev` (and `pnpm mobile`).

## 8. Troubleshooting

**"docker is not recognized" / `pnpm db:up` fails**
Open Docker Desktop and wait for "Engine running". If Docker was just installed, close and reopen Command Prompt.

**"Port 3000 / 4000 / 5432 is already in use"**
Find what uses it, then close that program (or end it):

```bat
netstat -ano | findstr :4000
taskkill /PID <number from the last column> /F
```

Port 5432 is often a PostgreSQL installed directly on Windows. Stop that service, or change `5432:5432` in
`docker-compose.yml` to `5433:5432` and update both database URLs in `.env`.

**The phone can't reach the API**

1. The phone and PC must be on the **same Wi-Fi** (not guest Wi-Fi, not mobile data), or use `pnpm mobile:tunnel`.
2. When Windows Firewall asks about Node.js, click **Allow**. If you missed it: Windows Security → Firewall & network
   protection → Allow an app → Node.js → tick Private (and Public if your Wi-Fi is set to Public).
3. On the phone's browser, open the "Test from the phone browser" link that `pnpm mobile` printed
   (`http://<PC IP>:8081/__api/health`). You should see `{"status":"ok"...}`.
4. In the app, the login screen's **Test connection** button shows the address it uses and the result.

**Phone: "onResponse: must return new Response() when modifying the response"**
Fixed on 28 Sep 2026 in the app's API client. Restart `pnpm mobile` and reload the app in Expo Go (scan the QR code
again).

**`pnpm share` says "cloudflared is not installed"**
Run `winget install --id Cloudflare.cloudflared`, then close and reopen Command Prompt.

**Colleagues can't open the `pnpm share --lan` link**
They must be on the same network, and Node.js must be allowed in Windows Firewall (see above). Office "guest" Wi-Fi often
blocks devices from reaching each other: use `pnpm share` (internet link) instead.

**Expo Go: "Unable to resolve ../../App from node_modules/expo/AppEntry.js"**
Expo was started in the project root. Stop it (Ctrl+C) and run `pnpm mobile` instead.

**Expo Go can't connect even though the phone and PC are on the same Wi-Fi**

1. Look at the address list `pnpm mobile` prints. If your PC has two similar IPs (for example Wi-Fi `172.24.16.176` and
   `vEthernet (WSL)` `172.25.160.1`), the phone can only reach the **Wi-Fi** one. `pnpm mobile` picks it for you; if it
   picked wrong, run `pnpm mobile --ip <your Wi-Fi IP>`.
2. On the phone's browser, open the "Test from the phone browser" link it printed. If it doesn't load, the Wi-Fi blocks
   devices from talking to each other (common on café, office and guest Wi-Fi). Use `pnpm mobile:tunnel`, or connect the
   PC to your **phone's hotspot**.
3. If the app loads but says "Cannot reach the server": make sure `pnpm dev` is running (the message says "The MSMA API
   is not running on this PC" when it isn't), and that `apps\mobile\.env` does **not** set an old `EXPO_PUBLIC_API_URL`.

**Expo Go: "These accounts need to match" or "You need to be signed in to Expo Go and Expo CLI"**
Expo Go only opens a project when the PC's Expo CLI is signed in (`npx expo whoami`) **and** the phone's Expo Go is
signed in to an account that is a **member of msma-solutions** (the project owner). Add teammates at
expo.dev → msma-solutions → Settings → Members; they must accept the e-mail invitation, then sign out and back in to
Expo Go. Restart `pnpm mobile:go` and scan the new QR code. Signed-out ("anonymous") projects are refused by current
Expo Go versions.

**Expo Go says the project uses an unsupported SDK**
Update Expo Go from the Play Store / App Store. This project uses Expo SDK 57.

**Signed out after `pnpm db:seed`**
Expected: the seed recreates the user accounts, so old sessions end. Just sign in again.

**`EPERM: operation not permitted ... query_engine-windows.dll.node`**
Something still runs the API. Stop `pnpm dev` (Ctrl+C) and run the command again.

**`pnpm i` warns "Ignored build scripts"**
Approved packages are listed under `allowBuilds` in `pnpm-workspace.yaml`. Run `pnpm approve-builds` for anything new.

## 9. Tests

- `pnpm test`: 48 unit tests (DTR rules, payroll golden cases in ₱, money/Manila time, 201 checklist and access rules),
  3 API client tests, and 31 API end-to-end tests (login + throttling, dashboard, approvals with audit log, `/iclock`,
  201 uploads/access/consent).
  They run on the `msma_hris_test` database, so demo data is never touched. Docker must be running.
- `pnpm test:e2e`: one Playwright browser test (first time: `pnpm --filter @msma/web exec playwright install chromium`).

## 10. Project rules

See `CLAUDE.md` (money as decimals in ₱, Asia/Manila time, module boundaries, roles, no secrets in git) and
`PROGRESS.md` (build log and decisions). The demo walkthrough is in `DEMO.md`.
