import { Body, Controller, ForbiddenException, Get, HttpCode, Injectable, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NoticeInput, NoticeInputSchema } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, requireEmployeeId, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { EmployeesService } from '../employees/employees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const EVERYONE = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'] as const;

/**
 * Memos about repeated lateness or AWOL (Reports › Tardiness). They never change pay. The employee reads and
 * acknowledges them on their Attendance page. Sent by the Super Admin (the access table's "edit" on attendance
 * records); HR, Accounting and the employee's approver can read them.
 */
@Injectable()
export class NoticesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private view(n: { id: string; kind: string; subject: string; message: string; dates: string[]; sentBy: string; sentAt: Date; acknowledgedAt: Date | null; employee: { employeeNo: string } }) {
    return { id: n.id, employeeId: n.employee.employeeNo, kind: n.kind as 'tardiness' | 'awol', subject: n.subject, message: n.message, dates: n.dates, sentBy: n.sentBy, sentAt: n.sentAt.toISOString(), ...(n.acknowledgedAt ? { acknowledgedAt: n.acknowledgedAt.toISOString() } : {}) };
  }

  async list(user: AuthUser) {
    const all = ['HR_ADMIN', 'SYSTEM_ADMIN', 'PAYROLL_ADMIN'].includes(user.role);
    const team = user.role === 'MANAGER' && user.employeeId ? await this.employees.teamIds(user.employeeId) : [];
    const ids = all ? undefined : [...team, ...(user.employeeId ? [user.employeeId] : [])];
    const rows = await this.prisma.attendanceNotice.findMany({ where: ids ? { employeeId: { in: ids } } : {}, include: { employee: { select: { employeeNo: true } } }, orderBy: { sentAt: 'desc' }, take: 500 });
    return rows.map((n) => this.view(n));
  }

  async send(input: NoticeInput, user: AuthUser) {
    const e = await this.prisma.employee.findUnique({ where: { employeeNo: input.employeeId } });
    if (!e) throw new NotFoundException('That employee no longer exists');
    if (e.id === user.employeeId) throw new ForbiddenException("You can't send a notice to yourself");
    const n = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attendanceNotice.create({ data: { employeeId: e.id, kind: input.kind, subject: input.subject, message: input.message, dates: input.dates, sentBy: user.displayName, sentById: user.userId }, include: { employee: { select: { employeeNo: true } } } });
      await this.audit.log({ actorId: user.userId, action: input.kind === 'awol' ? 'AWOL_NOTICE_SENT' : 'TARDINESS_NOTICE_SENT', entity: 'Employee', entityId: e.id, after: { subject: input.subject, days: input.dates.length } }, tx);
      return row;
    });
    await this.notifications.send({ topic: 'attendance', kind: 'alert', title: `${input.kind === 'awol' ? 'AWOL' : 'Tardiness'} notice: ${input.subject}`, body: `From ${user.displayName}. Read it and acknowledge it on your Attendance page.`, employeeIds: [e.id], actorId: user.userId });
    return this.view(n);
  }

  async acknowledge(id: string, user: AuthUser) {
    const employeeId = requireEmployeeId(user);
    const n = await this.prisma.attendanceNotice.findUnique({ where: { id } });
    if (!n || n.employeeId !== employeeId) throw new NotFoundException('That notice no longer exists');
    if (n.acknowledgedAt) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.attendanceNotice.update({ where: { id }, data: { acknowledgedAt: new Date() } });
      await this.audit.log({ actorId: user.userId, action: 'NOTICE_ACKNOWLEDGED', entity: 'Employee', entityId: employeeId, after: { subject: n.subject } }, tx);
    });
  }
}

@ApiTags('attendance')
@ApiBearerAuth()
@Roles(...EVERYONE)
@Controller('timekeeping/notices')
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  @ApiOperation({ operationId: 'listNotices', summary: 'Tardiness and AWOL notices: your own, your team, or everyone for HR, Accounting and the Super Admin' })
  list(@CurrentUser() user: AuthUser) {
    return this.notices.list(user);
  }

  @Post()
  @Roles('SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'sendNotice', summary: 'Send a tardiness or AWOL notice (never changes pay)' })
  @ApiZodBody(NoticeInputSchema)
  send(@CurrentUser() user: AuthUser, @Body(new ZodPipe(NoticeInputSchema)) body: NoticeInput) {
    return this.notices.send(body, user);
  }

  @Post(':id/acknowledge')
  @HttpCode(204)
  @ApiOperation({ operationId: 'acknowledgeNotice', summary: 'Acknowledge a notice sent to you' })
  async acknowledge(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notices.acknowledge(id, user);
  }
}
