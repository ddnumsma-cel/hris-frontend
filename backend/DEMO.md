# 6-minute demo script (for the project manager)

Synthetic data only. Payroll numbers are a SAMPLE (rates not yet verified).

## Before the meeting (5 minutes earlier)

1. Open Docker Desktop and wait for "Engine running".
2. In Command Prompt, in the project folder:
   ```bat
   pnpm db:up
   pnpm db:seed
   pnpm dev
   ```
   `pnpm db:seed` gives fresh data dated today (Jose has not clocked in yet, 9 approvals waiting).
3. In a second Command Prompt: `pnpm mobile`, then open the app on the Android phone with Expo Go (scan the QR code) and
   sign in as `employee@msma.test` / `Demo@2026`.
4. In the browser, open http://localhost:3000 and sign in as `hr@msma.test` / `Demo@2026`.
5. Keep a third Command Prompt ready for `pnpm simulate:punch`.

## The demo

**0:00 Dashboard (1 min).** "This is what HR sees every morning."

- Point at the six cards: headcount 180, present, late (amber), absent (red), on leave, pending approvals.
- The attendance trend for the last 14 working days and present-by-site bars.
- Biometric terminals: three online, **Lapu-Lapu offline**. "Terminals keep punches and upload them when the internet returns."

**1:00 Filter by site (30 s).** Click **Mandaue**, then **Lapu-Lapu**, then **All sites**. Every card, the chart and the
live punches change.

**1:30 A fingerprint punch (45 s).** In the third Command Prompt:

```bat
pnpm simulate:punch
```

It prints the employee's name. Within 10 seconds that name appears at the top of **Live punches** with "Face" or
"Fingerprint". "This is exactly what a ZKTeco terminal sends. No one touched the database."

**2:15 Clock in from the phone (45 s).** On the phone: **Clock in** → **Clock in with fingerprint** (or face / PIN) and confirm on the phone.
The phone shows the time (and "Late by … min"). On the dashboard, **Jose Reyes · Phone (fingerprint / face)** appears in Live punches
within 10 seconds, and "Present today" goes up by one. (The camera step is a placeholder in the sample.)

**3:00 Approve a leave (1 min).** On the phone, open **Requests**: Jose's vacation leave is **Pending**.
On the web, open **Approvals**, find Jose Reyes → **Approve** → the dialog explains exactly what happens → **Approve request**.
Within 10 seconds the phone shows **Approved**, and on Home his vacation balance drops by 2 days.
"Every decision is saved in the audit log with who, when and why."
(Optional: reject another request. A reason is required and the employee sees it.)

**4:00 Payroll preview (45 s).** Open **Payroll**. Point at the yellow **SAMPLE: rates not yet verified** banner, the
₱ totals, the per-employee lines (basic, OT, night diff, SSS, PhilHealth, Pag-IBIG, tax, net) and **Export CSV** / **Print**.
"Accounting can check this in Excel. Real rates get verified before we go live."

**4:45 The 201 file (1 min).** Back on the Dashboard, **Things to do today** reads like a to-do list: expired
clearances, renewals due, employees without a biometric consent form. Click **Open 201 files**, then the **Expiring in
30 days** box. Open **Jose Reyes → 201 file**: his NBI clearance expires soon and medical results are missing. Press
**Upload** on the medical results, pick any PDF, **Save to 201 file**: the item turns **On file**. "Medical results are
restricted: only HR can open them, and every opening is logged." On the phone, Home → **My 201 file** shows what HR still
needs from Jose.

**5:45 Close (15 s).** Settings → Appearance: Light / Dark / Match my device, bigger text, compact tables for payroll.
"Same system on web, Android and iPhone, one database."

## If something goes wrong

- Dashboard empty or login fails: is `pnpm dev` still running? Run `pnpm db:seed` again and sign in again.
- Phone can't connect: see README → Troubleshooting → "The phone can't reach the API". As a backup, show the web only.
- Jose already clocked in (demo run twice): `pnpm db:seed` resets everything.
