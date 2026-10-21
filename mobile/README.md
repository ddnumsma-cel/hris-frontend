# MSMA HRIS — Mobile UI

> **This folder is the Mobile UI**: the employee phone app (Expo / React Native), kept on the `mobile-ui`
> branch of the website (hris-frontend). It is **not** part of the website build: `npm run dev` / `npm run build`
> in the website folder never touch it.

- **Where it came from:** a copy of `apps/mobile` from the backend repo
  ([MSMA-HRIS-backend](https://github.com/adymsma-works/MSMA-HRIS-backend)), with the two shared packages it needs
  copied into `packages/` (`@msma/shared`: dates, money, labels, theme; `@msma/api-client`: the typed API client).
  Because it's a copy, later changes to the backend repo's app don't flow in automatically.
- **What changed:** only the look. It uses the website's design (Slate & Sky, dark mode Steel & Ice, Lexend,
  gradient primary buttons, 12px cards, 9px controls, pills, the MSMA mark). Screens, data and features are the
  backend app's own. Colours and radii live in `packages/shared/src/theme.ts`; keep them in step with the website's
  `src/index.css`. Text uses `font(weight)` from `src/components/ui.tsx` (Lexend has one file per weight).
- **Data:** the MSMA HRIS backend. The app calls `<address it loaded from>/__api/…` and the Expo dev server passes
  that to the API on this PC (port 4000), so leave `.env` empty.

## Run it

The database and the backend API must be running first (see the website's notes). Then:

```powershell
cd C:\Users\User\hris-frontend\mobile
npm install          # first time only
npm run mobile
```

Scan the QR code with **Expo Go** (phone on the same Wi-Fi as the PC; choose "Proceed anonymously" if asked to
log in to Expo). Sign in as `employee@msma.test` / `Demo@2026`.

| Situation | Command |
| --- | --- |
| Phone on another network or mobile data | `npm run mobile:tunnel` |
| Strange errors after changes | `npm run mobile:clear` |
| It picked the wrong address | `npm run mobile -- --ip 192.168.1.25` |
| Look at it in a browser | `npx expo start --web` |

Type check: `npx tsc --noEmit`.
