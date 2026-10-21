import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import type { Role } from '@msma/shared';

/** The authenticated caller, attached to the request by the global AuthGuard. */
export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
  employeeId: string | null;
  displayName: string;
}

export const IS_PUBLIC = 'isPublic';
/** Opt an endpoint out of JWT authentication (login, device push, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES_KEY = 'roles';
/** Restrict an endpoint to these roles. Endpoints without @Roles accept any signed-in user. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);

/** The caller's employee id; 403 if the account is not linked to an employee. */
export function requireEmployeeId(user: AuthUser): string {
  if (!user.employeeId)
    throw new ForbiddenException('This account is not linked to an employee record');
  return user.employeeId;
}

export const isHrLike = (role: Role) => role === 'HR_ADMIN' || role === 'SYSTEM_ADMIN';
export const canSeePay = (role: Role) =>
  role === 'HR_ADMIN' || role === 'SYSTEM_ADMIN' || role === 'PAYROLL_ADMIN';
