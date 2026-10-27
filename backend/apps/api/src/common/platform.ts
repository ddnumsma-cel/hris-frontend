import type { AuthUser } from './auth.decorators';

/**
 * The IT team's shared System Admin account (role PLATFORM_ADMIN, the website's System Admin): answers support
 * tickets and manages the plan and seats. SYSTEM_ADMIN is the client's Super Admin, so it isn't this. The role is
 * listed only on the endpoints it needs, so everything else (HR, pay, attendance) refuses it.
 */
export function isPlatformAdmin(user: AuthUser): boolean {
  return user.role === 'PLATFORM_ADMIN';
}
