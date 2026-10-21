# ADR-0002: Temporary online access from the laptop (before AWS)

**Status:** Accepted (for demos and user testing with synthetic data only) · **Date:** 28 Sep 2026

## Context

The team wants colleagues (HR, lawyers, accountants) to try the system from their own computers and phones before the
AWS deployment, while the backend runs on one Windows laptop behind a home/office router.

## Decision

`pnpm share` (`scripts/share.mjs`):

1. builds and runs a **separate production copy** (API :4010, web :3010) next to `pnpm dev`, with a **new random
   JWT secret** each run;
2. the browser reaches the API **through the web server** (`/api/*` rewrite in `apps/web/next.config.ts`), so only one
   address is exposed;
3. an **access-code page** (8 digits, new each run, 10 wrong tries per minute max) sits in front of everything on :3020;
4. a **Cloudflare quick tunnel** (`cloudflared`, free, no account, no router changes) gives an `https://….trycloudflare.com`
   link. `pnpm share --lan` skips the tunnel for colleagues on the same network.

The demo password is hidden on the login page when it is not opened from the local network. Sign-in is throttled
(5 wrong passwords → 15 minutes) for every account.

## Options considered

|                      | Cloudflare quick tunnel (chosen) | ngrok free                 | Tailscale (private network)         | Port forwarding on the router      |
| -------------------- | -------------------------------- | -------------------------- | ----------------------------------- | ---------------------------------- |
| Setup for colleagues | Open a link                      | Open a link (warning page) | Install Tailscale, join the network | Open a link                        |
| Setup here           | Install `cloudflared`            | Install + account          | Install + account                   | Router admin, dynamic IP, no HTTPS |
| HTTPS                | Yes                              | Yes                        | Yes (private)                       | No                                 |
| Exposure             | Public link + access code        | Public link                | Only invited devices                | Public, laptop exposed             |
| Cost                 | Free                             | Free tier limits           | Free for small teams                | Free                               |

Tailscale is the most private option and a good choice if the testers can install an app. Port forwarding is rejected.
For a fixed address and e-mail-based login in front of the app, a **named** Cloudflare Tunnel with **Cloudflare Access**
needs a domain on Cloudflare; worth it only if testing runs for weeks.

## Consequences

- Works only while the laptop is on, awake and online; the link changes every run.
- Anyone with the link **and** the code can reach the sign-in page, so use synthetic data only and share the code
  separately from the link.
- Not a production setup: move to AWS (`docs/deploy-aws.md`) before real employee data.
