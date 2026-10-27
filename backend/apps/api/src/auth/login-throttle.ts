import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;
const MAX_TRACKED = 10_000;

/**
 * Slows down password guessing: at most 5 unsuccessful sign-ins per email within 15 minutes.
 * Keyed by email (not IP) because `pnpm share` and a cloud load balancer put everyone behind one address.
 *
 * An attempt is counted *before* the password is checked, so parallel requests cannot all slip through;
 * a successful sign-in clears the count. If an attacker floods the table with random emails, new emails
 * are refused until old entries expire (fail closed) instead of forgetting the locked ones.
 * In memory: fine for one API process; use Redis or the database when running several (docs/deploy-aws.md).
 */
@Injectable()
export class LoginThrottle {
  private readonly attempts = new Map<string, { count: number; firstAt: number }>();

  private tooMany(minutes: number): never {
    throw new HttpException(
      `Too many wrong passwords for this account. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or ask HR to reset it.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private sweep(now: number) {
    for (const [email, e] of this.attempts)
      if (now - e.firstAt > WINDOW_MS) this.attempts.delete(email);
  }

  /** Call before checking the password. Throws 429 when the email is locked. */
  begin(email: string, now = Date.now()) {
    let e = this.attempts.get(email);
    if (e && now - e.firstAt > WINDOW_MS) {
      this.attempts.delete(email);
      e = undefined;
    }
    if (!e) {
      if (this.attempts.size >= MAX_TRACKED) this.sweep(now);
      if (this.attempts.size >= MAX_TRACKED) this.tooMany(1);
      e = { count: 0, firstAt: now };
      this.attempts.set(email, e);
    }
    if (e.count >= MAX_ATTEMPTS)
      this.tooMany(Math.max(1, Math.ceil((WINDOW_MS - (now - e.firstAt)) / 60_000)));
    e.count += 1;
  }

  /** When the email stops being locked out, or null when it isn't (for the Users page). */
  lockedUntil(email: string, now = Date.now()): Date | null {
    const e = this.attempts.get(email);
    if (!e || e.count < MAX_ATTEMPTS || now - e.firstAt > WINDOW_MS) return null;
    return new Date(e.firstAt + WINDOW_MS);
  }

  /** Call after a successful sign-in. */
  succeeded(email: string) {
    this.attempts.delete(email);
  }
}
