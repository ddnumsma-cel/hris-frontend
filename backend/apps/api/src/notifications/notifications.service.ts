import { Global, Injectable, Module, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@msma/db';
import { Role } from '@msma/shared';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

/** The bell's icon. */
export type NoticeKind = 'request' | 'approved' | 'rejected' | 'update' | 'seat' | 'alert';
export type Topic =
  | 'leave'
  | 'overtime'
  | 'undertime'
  | 'adjustment'
  | 'payslip'
  | 'loan'
  | 'policy'
  | 'separation'
  | 'account'
  | 'support'
  | 'training'
  | 'subscription'
  | 'orgchart'
  | 'documents'
  | 'attendance'
  | 'claim'
  | 'certificate';

/** The website's roles, as the backend's (its links are per website role). */
const WEB_ROLE: Record<Role, string> = {
  PLATFORM_ADMIN: 'system_admin',
  SYSTEM_ADMIN: 'super_admin',
  HR_ADMIN: 'hr',
  MANAGER: 'approver',
  PAYROLL_ADMIN: 'accounting',
  EMPLOYEE: 'employee',
};
const ADMIN = (path: string) => ({ super_admin: path, hr: path, accounting: path, system_admin: path });
/** Each topic's page per website role: the website's own table (lib/noticeLinks.ts LINKS). */
const LINKS: Record<Topic, Record<string, string>> = {
  leave: { ...ADMIN('/admin/maintenance/leave/requests'), approver: '/manager/approvals?tab=leave', employee: '/employee/leave' },
  overtime: { ...ADMIN('/admin/reports/overtime'), approver: '/manager/approvals?tab=overtime', employee: '/employee/attendance' },
  undertime: { ...ADMIN('/admin/reports/undertime'), approver: '/manager/approvals?tab=undertime', employee: '/employee/attendance' },
  adjustment: { ...ADMIN('/admin/reports/time-adjustments'), approver: '/manager/approvals?tab=adjustments', employee: '/employee/attendance' },
  payslip: { ...ADMIN('/admin/payroll/runs'), employee: '/employee/payslips' },
  loan: { ...ADMIN('/admin/payroll/loans'), employee: '/employee/payslips' },
  policy: { ...ADMIN('/admin/maintenance/rules'), employee: '/employee/policies' },
  separation: { ...ADMIN('/admin/maintenance/people'), accounting: '/admin/payroll/final-pay' },
  account: ADMIN('/admin/administration/users'),
  support: { ...ADMIN('/admin/administration/support'), employee: '/employee/support' },
  training: { ...ADMIN('/admin/onboarding/trainings'), approver: '/manager/trainings', employee: '/employee/trainings' },
  claim: { ...ADMIN('/admin/requests/reimbursement'), approver: '/manager/approvals?tab=claims', employee: '/employee/reimbursements' },
  certificate: { ...ADMIN('/admin/requests/certificates'), employee: '/employee/certificates' },
  orgchart: { ...ADMIN('/admin/maintenance/org-chart'), approver: '/manager/workforce' },
  attendance: { ...ADMIN('/admin/reports/attendance-logs'), approver: '/manager/attendance', employee: '/employee/attendance' },
  documents: { ...ADMIN('/admin/maintenance/documents'), approver: '/employee/201-file', employee: '/employee/201-file' },
  subscription: { super_admin: '/admin/settings/subscription', hr: '/admin/settings/subscription', system_admin: '/admin/administration/subscription' },
};

export interface Notice {
  topic: Topic;
  kind: NoticeKind;
  title: string;
  body: string;
  /** Everyone holding these roles. */
  roles?: Role[];
  /** These people, by their employee record (whoever signs in with it). */
  employeeIds?: (string | null | undefined)[];
  /** These accounts. */
  userIds?: (string | null | undefined)[];
  /** The account that acted: never told about its own action. */
  actorId?: string | null;
}

/**
 * The bell: one notice per person told, created with the action that caused it, as the website's own
 * (lib/requestNotices.ts). A failed notice never undoes the action that sent it.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async send(n: Notice, db: PrismaService | Prisma.TransactionClient = this.prisma): Promise<number> {
    const employeeIds = (n.employeeIds ?? []).filter((x): x is string => !!x);
    const userIds = (n.userIds ?? []).filter((x): x is string => !!x);
    if (!n.roles?.length && !employeeIds.length && !userIds.length) return 0;
    try {
      const users = await db.user.findMany({
        where: {
          status: 'active',
          OR: [
            ...(n.roles?.length ? [{ role: { in: n.roles } }] : []),
            ...(employeeIds.length ? [{ employeeId: { in: employeeIds } }] : []),
            ...(userIds.length ? [{ id: { in: userIds } }] : []),
          ],
          ...(n.actorId ? { id: { not: n.actorId } } : {}),
        },
        select: { id: true, role: true },
      });
      if (!users.length) return 0;
      await db.notification.createMany({
        data: users.map((u) => ({ userId: u.id, kind: n.kind, topic: n.topic, title: n.title.slice(0, 200), body: n.body.slice(0, 1000), link: LINKS[n.topic][WEB_ROLE[u.role]] ?? null })),
      });
      return users.length;
    } catch {
      return 0;
    }
  }

  async mine(user: AuthUser) {
    const rows = await this.prisma.notification.findMany({ where: { userId: user.userId }, orderBy: { at: 'desc' }, take: 300 });
    return rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, ...(r.link ? { link: r.link } : {}), at: r.at.toISOString(), unread: !r.readAt }));
  }

  async markRead(user: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: user.userId, readAt: null }, data: { readAt: new Date() } });
  }
}

@ApiTags('notifications')
@ApiBearerAuth()
@Roles('EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN', 'PLATFORM_ADMIN')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ operationId: 'myNotifications', summary: 'Your bell notifications, newest first' })
  mine(@CurrentUser() user: AuthUser) {
    return this.notifications.mine(user);
  }

  @Post('read')
  @HttpCode(204)
  @ApiOperation({ operationId: 'markNotificationsRead', summary: 'Mark all your notifications read' })
  async read(@CurrentUser() user: AuthUser) {
    await this.notifications.markRead(user);
  }
}

/** Available everywhere, so any change can tell the people it concerns. */
@Global()
@Module({ controllers: [NotificationsController], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
