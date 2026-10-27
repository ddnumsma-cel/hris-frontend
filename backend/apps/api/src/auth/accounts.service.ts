import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import crypto from 'node:crypto';
import { Prisma } from '@msma/db';
import { CreateAccount, Role, WebRoleId } from '@msma/shared';
import bcrypt from 'bcryptjs';
import type { AuthUser } from '../common/auth.decorators';
import { SubscriptionService } from '../administration/subscription.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginThrottle } from './login-throttle';

/** The website's role ids (lib/admin/store.ts) and the backend roles they are. */
const ROLE_OF: Record<WebRoleId, Role> = {
  'system-admin': 'PLATFORM_ADMIN',
  'super-admin': 'SYSTEM_ADMIN',
  hr: 'HR_ADMIN',
  approver: 'MANAGER',
  accounting: 'PAYROLL_ADMIN',
  employee: 'EMPLOYEE',
};
const WEB_ROLE_OF = Object.fromEntries(Object.entries(ROLE_OF).map(([w, r]) => [r, w])) as Record<Role, WebRoleId>;
const ROLE_NAME: Record<WebRoleId, string> = {
  'system-admin': 'System Admin',
  'super-admin': 'Super Admin',
  hr: 'HR',
  approver: 'Approver',
  accounting: 'Accounting',
  employee: 'Employee',
};
/** Logins that take one of the plan's admin accounts. */
const ADMIN_ROLES: Role[] = ['HR_ADMIN', 'MANAGER', 'PAYROLL_ADMIN'];
/** Who may give (or change accounts holding) which role, as the website's LIMITS.assignableRoles. */
const ASSIGNABLE: Partial<Record<Role, Role[]>> = {
  PLATFORM_ADMIN: ['PLATFORM_ADMIN', 'SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'PAYROLL_ADMIN', 'EMPLOYEE'],
  SYSTEM_ADMIN: ['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'PAYROLL_ADMIN', 'EMPLOYEE'],
};

type UserRow = Prisma.UserGetPayload<{ include: { employee: { select: { employeeNo: true; firstName: true; lastName: true; email: true } } } }>;

/** A readable temporary password: a word, digits and a symbol, 12 characters or more. */
function tempPassword() {
  const words = ['Mango', 'Cebu', 'Lapu', 'Sinulog', 'Taal', 'Bohol', 'Malunggay', 'Sampaguita'];
  return `${words[crypto.randomInt(words.length)]}-${crypto.randomInt(1000, 10000)}${crypto.randomInt(10, 100)}!`;
}

/**
 * Administration › Users: sign-in accounts. The IT System Admin gives any role; the client's Super Admin every role
 * but System Admin; nobody changes their own access; there is always an active Super Admin; HR, Approver and
 * Accounting logins count against the plan's admin accounts. Passwords are never sent back, except a new
 * temporary one, once, to whoever made or reset it.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly throttle: LoginThrottle,
    private readonly subscription: SubscriptionService,
  ) {}

  private mayGive(user: AuthUser, role: Role) {
    return ASSIGNABLE[user.role]?.includes(role) ?? false;
  }

  private view(u: UserRow) {
    const roleId = WEB_ROLE_OF[u.role];
    const lockedUntil = this.throttle.lockedUntil(u.email);
    return {
      // The website keys backend logins as "be-<id>" (lib/backend/auth.ts).
      id: `be-${u.id}`,
      name: u.displayName,
      username: u.email,
      ...(u.employee ? { employeeId: u.employee.employeeNo, employeeName: `${u.employee.firstName} ${u.employee.lastName}` } : {}),
      roleId,
      roleName: ROLE_NAME[roleId],
      status: u.status === 'disabled' ? 'disabled' : 'active',
      mustChangePassword: u.mustChangePassword,
      ...(u.lastLoginAt ? { lastSignIn: u.lastLoginAt.toISOString() } : {}),
      failedAttempts: 0,
      ...(lockedUntil ? { lockedUntil: lockedUntil.toISOString() } : {}),
      locked: !!lockedUntil,
      createdAt: u.createdAt.toISOString(),
      ...(u.createdBy ? { createdBy: u.createdBy } : {}),
    };
  }

  private include = { employee: { select: { employeeNo: true, firstName: true, lastName: true, email: true } } } as const;

  async list() {
    const rows = await this.prisma.user.findMany({ include: this.include, orderBy: { displayName: 'asc' } });
    return rows.map((u) => this.view(u));
  }

  /** Current employees with no login yet: names and work emails only (no HR record), to link a new account. */
  async withoutAccount() {
    const rows = await this.prisma.employee.findMany({
      where: { active: true, user: null },
      select: { employeeNo: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return rows.map((e) => ({ id: e.employeeNo, name: `${e.firstName} ${e.lastName}`, email: e.email ?? '' }));
  }

  private async find(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id: id.replace(/^be-/, '') }, include: this.include });
    if (!u) throw new NotFoundException('That account no longer exists');
    return u;
  }

  /** At least one active Super Admin must remain after a change. */
  private async keepsSuperAdmin(changingId: string, nextRole: Role, nextStatus: string) {
    const others = await this.prisma.user.count({ where: { id: { not: changingId }, role: 'SYSTEM_ADMIN', status: 'active' } });
    if (others === 0 && !(nextRole === 'SYSTEM_ADMIN' && nextStatus === 'active')) throw new ConflictException('There must always be at least one active Super Admin.');
  }

  async create(input: CreateAccount, user: AuthUser) {
    const role = ROLE_OF[input.roleId];
    if (!this.mayGive(user, role)) throw new ForbiddenException("You can't give that role.");
    const email = input.username.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('That username is taken');
    let employeeId: string | null = null;
    if (input.employeeId) {
      const e = await this.prisma.employee.findUnique({ where: { employeeNo: input.employeeId }, include: { user: { select: { email: true } } } });
      if (!e || !e.active) throw new BadRequestException('Choose a current employee');
      if (e.user) throw new ConflictException(`This person already has an account (username ${e.user.email}).`);
      employeeId = e.id;
    }
    if (ADMIN_ROLES.includes(role)) await this.subscription.assertAdminAccount();
    const password = tempPassword();
    const created = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, passwordHash: await bcrypt.hash(password, 10), role, displayName: input.name, employeeId, mustChangePassword: true, createdBy: user.displayName },
      });
      await this.audit.log({ actorId: user.userId, action: 'ACCOUNT_ADDED', entity: 'User', entityId: u.id, after: { username: email, name: input.name, role: ROLE_NAME[input.roleId] } }, tx);
      return u;
    });
    return { username: created.email, password };
  }

  async setRole(id: string, roleId: WebRoleId, user: AuthUser) {
    const u = await this.find(id);
    const role = ROLE_OF[roleId];
    if (u.id === user.userId) throw new ForbiddenException("You can't change your own access. Ask another administrator.");
    if (!this.mayGive(user, role) || !this.mayGive(user, u.role)) throw new ForbiddenException("You can't give or change that role.");
    if (role === u.role) return;
    await this.keepsSuperAdmin(u.id, role, u.status);
    // Moving an active login into HR / Approver / Accounting takes an admin account.
    if (u.status === 'active' && ADMIN_ROLES.includes(role) && !ADMIN_ROLES.includes(u.role)) await this.subscription.assertAdminAccount();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { role } });
      await this.audit.log({ actorId: user.userId, action: 'ACCOUNT_ROLE_CHANGED', entity: 'User', entityId: u.id, before: { role: ROLE_NAME[WEB_ROLE_OF[u.role]] }, after: { username: u.email, role: ROLE_NAME[roleId] } }, tx);
    });
  }

  async setStatus(id: string, status: 'active' | 'disabled', user: AuthUser) {
    const u = await this.find(id);
    if (u.id === user.userId) throw new ForbiddenException("You can't change your own access. Ask another administrator.");
    if (!this.mayGive(user, u.role)) throw new ForbiddenException("You can't change that account.");
    if (status === u.status) return;
    await this.keepsSuperAdmin(u.id, u.role, status);
    if (status === 'active' && ADMIN_ROLES.includes(u.role)) await this.subscription.assertAdminAccount();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { status } });
      await this.audit.log({ actorId: user.userId, action: status === 'active' ? 'ACCOUNT_TURNED_ON' : 'ACCOUNT_TURNED_OFF', entity: 'User', entityId: u.id, after: { username: u.email } }, tx);
    });
  }

  /** Clears the wrong-password lockout. */
  async unlock(id: string, user: AuthUser) {
    const u = await this.find(id);
    if (!this.mayGive(user, u.role)) throw new ForbiddenException("You can't change that account.");
    this.throttle.succeeded(u.email);
    await this.audit.log({ actorId: user.userId, action: 'ACCOUNT_UNLOCKED', entity: 'User', entityId: u.id, after: { username: u.email } });
  }

  /** A new temporary password, shown once; they choose their own at the next sign-in. */
  async resetPassword(id: string, user: AuthUser) {
    const u = await this.find(id);
    if (!this.mayGive(user, u.role)) throw new ForbiddenException("You can't change that account.");
    const password = tempPassword();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true } });
      await this.audit.log({ actorId: user.userId, action: 'ACCOUNT_PASSWORD_RESET', entity: 'User', entityId: u.id, after: { username: u.email } }, tx);
    });
    this.throttle.succeeded(u.email);
    return { username: u.email, password };
  }

  /** The signed-in person replaces their password (a temporary one, or their own). */
  async changeOwnPassword(user: AuthUser, current: string, next: string) {
    const u = await this.prisma.user.findUnique({ where: { id: user.userId } });
    if (!u || !(await bcrypt.compare(current, u.passwordHash))) throw new BadRequestException('Your current password is incorrect.');
    if (current === next) throw new BadRequestException('Choose a password different from the current one.');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false } });
      await this.audit.log({ actorId: user.userId, action: 'ACCOUNT_OWN_PASSWORD_CHANGED', entity: 'User', entityId: u.id, after: { username: u.email } }, tx);
    });
  }
}
