# Setting up heyhr on another laptop

A step-by-step guide to get the HRIS running on a new computer. It takes about 15 minutes.
Written for Windows; Mac notes are included where something differs.

---

## 1. Install what you need (once per laptop)

| What | Why | Where to get it |
|---|---|---|
| **Git** | Downloads the code and keeps it up to date | <https://git-scm.com/downloads> (keep the default options while installing) |
| **Node.js 24 LTS** (22 or newer works) | Runs the app on your laptop | <https://nodejs.org> — choose the **LTS** version |
| **VS Code** (optional) | To read or edit the code | <https://code.visualstudio.com> |
| **A GitHub account** with access to the project | The code is kept on GitHub | Ask the project owner to add your account to `ddnumsma-cel/hris-frontend` |

To check the installs worked, open **PowerShell** (Windows) or **Terminal** (Mac) and run:

```
git --version
node -v
npm -v
```

Each should print a version number. `node -v` should show **v22** or higher.

---

## 2. Download the project

In PowerShell / Terminal, go to the folder where you keep projects (for example your Desktop) and run:

```
cd Desktop
git clone https://github.com/ddnumsma-cel/hris-frontend.git
cd hris-frontend
```

The first time, a window asks you to **sign in to GitHub** — sign in with the account that was given access.
If it says the repository wasn't found, your account doesn't have access yet: ask the owner to add you.

---

## 3. Install the app's packages

Still inside the `hris-frontend` folder:

```
npm install
```

This downloads everything the app needs into a `node_modules` folder. It takes a few minutes the
first time. Warnings are normal; only stop if it ends with **ERR!**.

---

## 4. Optional: Google sign-in

"Continue with Google" on the registration page needs a Google Client ID. Everything else works
without it, so you can skip this step.

1. Copy the example settings file:
   - Windows: `copy .env.example .env.local`
   - Mac: `cp .env.example .env.local`
2. Open `.env.local` and paste the Client ID after `VITE_GOOGLE_CLIENT_ID=` (ask the project owner
   for it, or create one in Google Cloud Console › APIs & Services › Credentials).
3. In Google Cloud Console, the Client ID must list `http://localhost:5173` under
   **Authorized JavaScript origins**.

`.env.local` stays on your laptop only; it is never uploaded to GitHub.

---

## 5. Start the app

```
npm run dev
```

When it says **ready**, open the address it shows — normally <http://localhost:5173> — in Chrome or Edge.
Leave the PowerShell window open while you use the app; press **Ctrl + C** in it to stop.

---

## 6. Sign in with a demo account

| Who | Username | Password |
|---|---|---|
| System Admin (our team) | `sysadmin` | `Heyhr-SysAdmin-2026!` |
| Super Admin (the client's IT) | `superadmin` | `Heyhr-Super-2026!` |
| HR | `admin1` | `Heyhr-HR-2026!` |
| HR officer | `hrofficer` | `Heyhr-Officer-2026!` |
| Approver / manager | `approver` | `Heyhr-Approver-2026!` |
| Partner (approver) | `antonio.sanchez` | `Heyhr-Partner1-2026!` |
| Accounting | `accounting` | `Heyhr-Accounting-2026!` |
| Employee self-service (Chris S. David) | `ceb.msma` | `Malunggay-4800` |

**Good to know about the data:** there's no server yet. Everything you add (employees, leave,
requests…) is saved **in that browser on that laptop only**. A new laptop starts with fresh demo
data, and two laptops don't see each other's changes.

To start over with fresh demo data: in the browser press **F12 › Application › Storage › Clear site
data**, then reload the page.

---

## 7. Every time you work on it

```
cd Desktop/hris-frontend
git pull
npm install
npm run dev
```

- `git pull` gets the latest changes from GitHub.
- `npm install` is only needed when someone added a package, but running it every time is harmless.

To send your own changes to GitHub (if you're allowed to):

```
git add -A
git commit -m "Short description of what you changed"
git pull
git push
```

---

## 8. Checking that everything works

| Command | What it checks |
|---|---|
| `npm run build` | The app compiles without errors (do this before pushing) |
| `npm run lint` | Code quality warnings and errors |
| `npm run check:subscription` | Seat limits and subscription rules, as each demo account |
| `npm run check:notifications` | Who gets which bell notification |
| `npm run check:payroll` | Payroll calculations |

Each check prints **All checks passed** (or **All examples pass**) when everything is fine.

---

## 9. Optional: open it on a phone

To try the app on a phone on the same Wi-Fi:

```
npm run dev -- --host
```

It then also shows a **Network** address (like `http://192.168.1.20:5173`) — open that on the phone.

The face-scan clock-in needs the camera, and phones only allow the camera on **https**. For that,
install [mkcert](https://github.com/FiloSottile/mkcert), then in the project folder:

```
mkcert -install
mkdir .certs
mkcert -key-file .certs/key.pem -cert-file .certs/cert.pem localhost 127.0.0.1 YOUR-LAPTOP-IP
```

Restart `npm run dev -- --host` and use the `https://` address. (`.certs` is never uploaded to GitHub.)

---

## 10. If something goes wrong

| Problem | Fix |
|---|---|
| `git` or `node` "is not recognized" | Close and reopen PowerShell after installing. If it still fails, reinstall and keep "Add to PATH" ticked. |
| `npm install` fails with **ERR!** | Check `node -v` is v22 or newer. Then delete the `node_modules` folder and run `npm install` again. |
| "Port 5173 is in use" | The app is already running in another window — use that one, or close it. Vite may also just pick 5174; use the address it prints. |
| "Repository not found" when cloning | Your GitHub account doesn't have access yet; ask the owner to add you. |
| The page looks old after `git pull` | Press **Ctrl + Shift + R** to reload without the cache (the app works offline, so the browser can hold on to the old version). If you ever ran `npm run preview` or installed the app, `npm run dev` clears that offline copy by itself on the next reload; if it still looks old, open **F12 › Application › Service workers** and click **Unregister**. |
| Login says the password is wrong | Type it exactly as in the table (it's case-sensitive). If you changed it earlier on this laptop, clear site data (step 6). |
| Blank white page | Look at the PowerShell window for a red error and at the browser console (**F12 › Console**); share both with the team. |

---

More about how the app is built: `CLAUDE.md` (design and rules), `BACKEND_HANDOFF.md` (what a real
server needs to provide), and `docs/` (requirements and user stories).
