import { Body, Controller, Delete, Get, Header, HttpCode, Injectable, Module, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { seal, unseal } from '@msma/db';
import { EXPORT_DATASETS, ExportDataset, OutboxInput, OutboxInputSchema, utcDateToDateKey } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { PrismaService } from '../prisma/prisma.service';

/** Kept: the newest messages only, like the website's own list. */
const KEEP = 300;

/**
 * Administration › Outbox: emails and texts the system would send. Nothing sends them yet; they wait here so
 * the Super Admin can see what would go out. The website names the employee; the backend looks up their work
 * email and mobile itself (stored encrypted here), so a browser never holds anyone else's address.
 */
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async queue(input: OutboxInput) {
    const people = await this.prisma.employee.findMany({
      where: { employeeNo: { in: [...new Set(input.messages.map((m) => m.employeeId))] }, separationDate: null },
      select: { id: true, employeeNo: true, firstName: true, lastName: true, email: true, mobileNo: true },
    });
    const by = new Map(people.map((p) => [p.employeeNo, p]));
    const rows = input.messages.flatMap((m) => {
      const p = by.get(m.employeeId);
      if (!p) return [];
      const to = `${p.firstName} ${p.lastName}`;
      return [
        ...(p.email ? [{ employeeId: p.id, channel: 'email', to, address: seal(p.email), subject: m.subject, body: m.body, event: m.event }] : []),
        ...(m.sms && p.mobileNo ? [{ employeeId: p.id, channel: 'sms', to, address: seal(p.mobileNo), subject: 'Text message', body: m.sms, event: m.event }] : []),
      ];
    });
    if (rows.length) await this.prisma.outboxMessage.createMany({ data: rows });
    // Only the newest are kept.
    const old = await this.prisma.outboxMessage.findMany({ orderBy: { at: 'desc' }, skip: KEEP, select: { id: true } });
    if (old.length) await this.prisma.outboxMessage.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return { queued: rows.length };
  }

  async list() {
    const rows = await this.prisma.outboxMessage.findMany({ orderBy: { at: 'desc' }, take: KEEP });
    return rows.map((m) => ({ id: m.id, channel: m.channel as 'email' | 'sms', to: m.to, address: unseal(m.address), subject: m.subject, body: m.body, event: m.event, at: m.at.toISOString(), status: 'waiting' as const }));
  }

  async clear() {
    await this.prisma.outboxMessage.deleteMany({});
  }
}

/** One CSV cell: quoted when needed, and never read by a spreadsheet as a formula. */
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows: Record<string, unknown>[]) => (rows.length ? [Object.keys(rows[0]!), ...rows.map((r) => Object.values(r))].map((r) => r.map(cell).join(',')).join('\r\n') : '');

const ROLE_NAME: Record<string, string> = { EMPLOYEE: 'Employee', MANAGER: 'Approver', HR_ADMIN: 'HR', PAYROLL_ADMIN: 'Accounting', SYSTEM_ADMIN: 'Super Admin', PLATFORM_ADMIN: 'System Admin' };

/** Admin settings › Data & privacy › Export data: CSV made on the backend, each export audited. */
@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async rows(dataset: ExportDataset): Promise<Record<string, unknown>[]> {
    if (dataset === 'employees') {
      const es = await this.prisma.employee.findMany({ include: { position: true, department: true, site: true }, orderBy: { employeeNo: 'asc' } });
      return es.map((e) => ({
        'Employee ID': e.employeeNo,
        Name: `${e.firstName} ${e.lastName}`,
        Position: e.position?.title ?? '',
        Department: e.department.name,
        Office: e.site.name,
        Status: e.separationDate ? 'Separated' : e.status,
        'Date hired': utcDateToDateKey(e.hireDate),
        Email: e.email ?? '',
      }));
    }
    if (dataset === 'leave') {
      const rs = await this.prisma.leaveRequest.findMany({ include: { employee: { select: { firstName: true, lastName: true } }, leaveType: { select: { name: true } } }, orderBy: { createdAt: 'desc' } });
      return rs.map((r) => ({
        'Request ID': r.id,
        Employee: `${r.employee.firstName} ${r.employee.lastName}`,
        Type: r.leaveType.name,
        Start: utcDateToDateKey(r.startDate),
        End: utcDateToDateKey(r.endDate),
        Days: Number(r.days),
        Status: r.status.toLowerCase(),
        'Filed at': r.createdAt.toISOString(),
      }));
    }
    if (dataset === 'accounts') {
      const us = await this.prisma.user.findMany({ orderBy: { email: 'asc' } });
      return us.map((u) => ({ Username: u.email, Name: u.displayName, Role: ROLE_NAME[u.role] ?? u.role, Status: u.status, 'Last sign-in': u.lastLoginAt?.toISOString() ?? '' }));
    }
    const ls = await this.prisma.auditLog.findMany({ include: { actor: { select: { displayName: true } } }, orderBy: { at: 'desc' }, take: 50_000 });
    return ls.map((l) => ({ When: l.at.toISOString(), Who: l.actor?.displayName ?? 'System', Action: l.action, Record: l.entity, 'Record ID': l.entityId }));
  }

  async csv(dataset: ExportDataset, user: AuthUser) {
    const rows = await this.rows(dataset);
    await this.audit.log({ actorId: user.userId, action: 'DATA_EXPORTED', entity: 'Settings', entityId: `export:${dataset}`, after: { rows: rows.length } });
    return toCsv(rows);
  }
}

@ApiTags('administration')
@ApiBearerAuth()
@Controller()
export class DataToolsController {
  constructor(
    private readonly outbox: OutboxService,
    private readonly exports: ExportsService,
  ) {}

  @Post('outbox')
  @Roles('MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'queueOutbox', summary: 'Queue emails (and texts) to employees; the backend looks up their addresses' })
  @ApiZodBody(OutboxInputSchema)
  queue(@Body(new ZodPipe(OutboxInputSchema)) body: OutboxInput) {
    return this.outbox.queue(body);
  }

  @Get('outbox')
  @Roles('SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'listOutbox', summary: 'Messages waiting to go out, newest first' })
  list() {
    return this.outbox.list();
  }

  @Delete('outbox')
  @HttpCode(204)
  @Roles('SYSTEM_ADMIN')
  @ApiOperation({ operationId: 'clearOutbox', summary: 'Clear the outbox' })
  async clear() {
    await this.outbox.clear();
  }

  @Get('admin/exports/:dataset')
  @Roles('SYSTEM_ADMIN')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ operationId: 'exportDataset', summary: 'Download a dataset as CSV (audited)' })
  exportCsv(@CurrentUser() user: AuthUser, @Param('dataset', new ParseEnumPipe(EXPORT_DATASETS)) dataset: ExportDataset) {
    return this.exports.csv(dataset, user);
  }
}

@Module({ controllers: [DataToolsController], providers: [OutboxService, ExportsService] })
export class DataToolsModule {}
