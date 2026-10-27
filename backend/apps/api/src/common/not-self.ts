import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from './auth.decorators';

/**
 * HR and Accounting keep everyone's records, their own included, so nobody may change their own leave credits, pay
 * settings, loans or payroll lines, release their own claim or issue their own certificate: someone else has to.
 */
export function notSelf(user: AuthUser, employeeId: string | null | undefined, what: string) {
  if (employeeId && user.employeeId && employeeId === user.employeeId)
    throw new ForbiddenException(`You can't ${what} for yourself. Ask a colleague or the Super Admin to do it.`);
}
