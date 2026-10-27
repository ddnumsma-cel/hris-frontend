import type { AuthUser } from './auth.decorators';

/**
 * Our own team (support, plans and seats for the client), named by email in PLATFORM_ADMIN_EMAILS, comma separated.
 * The backend's SYSTEM_ADMIN is the client's Super Admin, so it can't be this; .env can't be changed from the app.
 */
export function isPlatformAdmin(user: AuthUser): boolean {
  const emails = (process.env.PLATFORM_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return emails.includes(user.email.toLowerCase());
}
