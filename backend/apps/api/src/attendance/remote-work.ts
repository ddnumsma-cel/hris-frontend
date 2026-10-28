import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { addDays, dateKeyToUtcDate, formatTime, manilaToday, RemoteClockInput, RemoteClockSchema, RemoteDayInput, RemoteDayInputSchema, utcDateToDateKey, WfhInput, WfhSchema } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, requireEmployeeId, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { EmployeesService } from '../employees/employees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './attendance.service';

/** Punches made from home with the website's face scan (counted in attendance like any other). */
export const REMOTE_DEVICE_SERIAL = 'REMOTE-WEB';
const EVERYONE = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'] as const;
const ROLES_TOLD = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'] as const;
/** "Oct 28" or "Oct 28 – Oct 30". */
const when = (from: string, to: string) => {
  const d = (k: string) => new Date(`${k}T12:00:00+08:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  return from === to ? d(from) : `${d(from)} – ${d(to)}`;
};
const localAt = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
};

/**
 * Remote work days: days HR or the Super Admin declares (typhoons, emergencies) for some offices or all, and days someone
 * chooses to work from home themselves. On those days people clock in and out from the website with a face scan;
 * the punches count in attendance like the office machines'. Switching back to an office day sets that day's
 * home punches aside (kept on record, not counted).
 */
@Injectable()
export class RemoteWorkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private view(d: { id: string; fromDate: Date; toDate: Date; offices: string[]; reason: string; declaredBy: string; declaredAt: Date }) {
    return { id: d.id, from: utcDateToDateKey(d.fromDate), to: utcDateToDateKey(d.toDate), offices: d.offices, reason: d.reason, declaredBy: d.declaredBy, declaredAt: d.declaredAt.toISOString() };
  }

  /** The declared day covering this person today (their office's, or everyone's). */
  private async declaredFor(employeeId: string, date: string) {
    const siteId = await this.employees.siteIdOf(employeeId);
    const site = siteId ? await this.prisma.site.findUnique({ where: { id: siteId }, select: { name: true } }) : null;
    const days = await this.prisma.remoteDay.findMany({ where: { cancelledAt: null, fromDate: { lte: dateKeyToUtcDate(date) }, toDate: { gte: dateKeyToUtcDate(date) } } });
    return days.find((d) => !d.offices.length || (site && d.offices.includes(site.name))) ?? null;
  }

  /** What the website's timekeeping store needs: every declared day, and the work-from-home days and home punches in scope. */
  async state(user: AuthUser) {
    const all = ['HR_ADMIN', 'SYSTEM_ADMIN', 'PAYROLL_ADMIN'].includes(user.role);
    const team = user.role === 'MANAGER' && user.employeeId ? await this.employees.teamIds(user.employeeId) : [];
    const ids = all ? undefined : [...team, ...(user.employeeId ? [user.employeeId] : [])];
    const since = dateKeyToUtcDate(addDays(manilaToday(), -62));
    const [days, wfh, punches] = await Promise.all([
      this.prisma.remoteDay.findMany({ where: { cancelledAt: null }, orderBy: { fromDate: 'desc' }, take: 200 }),
      this.prisma.wfhDay.findMany({ where: { date: { gte: since }, ...(ids ? { employeeId: { in: ids } } : {}) }, include: { employee: { select: { employeeNo: true } } } }),
      this.prisma.remotePunch.findMany({ where: { workDate: { gte: since }, ...(ids ? { employeeId: { in: ids } } : {}) }, include: { employee: { select: { employeeNo: true } } }, orderBy: { punchedAt: 'asc' } }),
    ]);
    return {
      remoteDays: days.map((d) => this.view(d)),
      wfh: wfh.map((w) => ({ id: w.id, employeeId: w.employee.employeeNo, date: utcDateToDateKey(w.date), declaredAt: w.declaredAt.toISOString() })),
      remotePunches: punches.map((p) => ({
        id: p.id,
        employeeId: p.employee.employeeNo,
        workDate: utcDateToDateKey(p.workDate),
        at: localAt(p.punchedAt),
        kind: p.kind as 'in' | 'out',
        source: 'face' as const,
        device: 'Remote · face scan',
        deviceRegistered: true,
        ...(p.match !== null ? { match: p.match } : {}),
        ...(p.lat !== null && p.lng !== null ? { location: { lat: p.lat, lng: p.lng, accuracy: p.accuracy ?? 0 } } : p.locationNote ? { location: { unavailable: p.locationNote } } : {}),
        reason: p.reason,
        recordedBy: p.recordedBy,
        ...(p.voidedAt ? { voided: { reason: p.voidReason ?? '', by: p.voidedBy ?? '', at: p.voidedAt.toISOString() } } : {}),
      })),
    };
  }

  async declare(input: RemoteDayInput, user: AuthUser) {
    if (input.to < input.from) throw new BadRequestException("The last day can't be before the first");
    if (input.to < manilaToday()) throw new BadRequestException('Those days have passed. Fix past attendance with time adjustments instead.');
    const overlapping = await this.prisma.remoteDay.findMany({ where: { cancelledAt: null, fromDate: { lte: dateKeyToUtcDate(input.to) }, toDate: { gte: dateKeyToUtcDate(input.from) } } });
    if (overlapping.some((d) => !d.offices.length || !input.offices.length || d.offices.some((o) => input.offices.includes(o))))
      throw new ConflictException('Some of those days are already remote work days for these offices');
    const day = await this.prisma.$transaction(async (tx) => {
      const d = await tx.remoteDay.create({ data: { fromDate: dateKeyToUtcDate(input.from), toDate: dateKeyToUtcDate(input.to), offices: input.offices, reason: input.reason, declaredBy: user.displayName, declaredById: user.userId } });
      await this.audit.log({ actorId: user.userId, action: 'REMOTE_DAY_DECLARED', entity: 'RemoteDay', entityId: d.id, after: { from: input.from, to: input.to, offices: input.offices.join(', ') || 'Everyone', reason: input.reason } }, tx);
      return d;
    });
    await this.notifications.send({ topic: 'attendance', kind: 'update', title: `Remote work day: ${when(input.from, input.to)}`, body: `${input.offices.length ? `${input.offices.join(', ')} offices` : 'Everyone'} works from home. "${input.reason}" Clock in from home with a face scan.`, roles: [...ROLES_TOLD], actorId: user.userId });
    return this.view(day);
  }

  async cancel(id: string, user: AuthUser) {
    const d = await this.prisma.remoteDay.findUnique({ where: { id } });
    if (!d || d.cancelledAt) throw new NotFoundException('That remote work day no longer exists');
    const started = utcDateToDateKey(d.fromDate) <= manilaToday();
    if (started && (await this.prisma.remotePunch.count({ where: { workDate: { gte: d.fromDate, lte: d.toDate }, voidedAt: null } })))
      throw new ConflictException('People already clocked in from home on these days, so they stay on record. You can only cancel days that haven’t started.');
    await this.prisma.$transaction(async (tx) => {
      await tx.remoteDay.update({ where: { id }, data: { cancelledAt: new Date() } });
      await this.audit.log({ actorId: user.userId, action: 'REMOTE_DAY_CANCELLED', entity: 'RemoteDay', entityId: id, before: { from: utcDateToDateKey(d.fromDate), to: utcDateToDateKey(d.toDate), reason: d.reason } }, tx);
    });
  }

  /** Work from home today, or back to an office day (today's home punches are set aside, kept on record). */
  async setWfh(on: boolean, user: AuthUser) {
    const employeeId = requireEmployeeId(user);
    const today = manilaToday();
    const declared = await this.declaredFor(employeeId, today);
    if (declared) throw new ConflictException('Today is already a remote work day for your office');
    if (on) {
      await this.prisma.wfhDay.upsert({ where: { employeeId_date: { employeeId, date: dateKeyToUtcDate(today) } }, create: { employeeId, date: dateKeyToUtcDate(today) }, update: {} });
      const managerId = await this.employees.managerIdOf(employeeId);
      if (managerId) await this.notifications.send({ topic: 'attendance', kind: 'update', title: `${user.displayName} is working from home today`, body: 'They clock in with a face scan. You can see their times in Team Attendance.', employeeIds: [managerId], actorId: user.userId });
      return;
    }
    const today0 = dateKeyToUtcDate(today);
    const mine = await this.prisma.remotePunch.findMany({ where: { employeeId, workDate: today0, voidedAt: null } });
    await this.prisma.$transaction(async (tx) => {
      await tx.wfhDay.deleteMany({ where: { employeeId, date: today0 } });
      for (const p of mine) {
        await tx.remotePunch.update({ where: { id: p.id }, data: { voidedAt: new Date(), voidReason: 'Switched back to an office day', voidedBy: user.displayName } });
        // The punch itself is append-only: a set-aside record keeps it on file without counting it.
        if (p.rawPunchId) await tx.punchVoid.create({ data: { rawPunchId: p.rawPunchId, reason: 'Switched back to an office day', by: user.displayName } });
      }
      if (mine.length) await this.audit.log({ actorId: user.userId, action: 'REMOTE_PUNCHES_SET_ASIDE', entity: 'Employee', entityId: employeeId, after: { date: today, punches: mine.length, reason: 'Switched back to an office day' } }, tx);
    });
    if (mine.length) await this.attendance.recompute(addDays(today, -1), today, [employeeId]);
  }

  /** A time-in or time-out from home after the website's face scan; only on a remote work day. */
  async clock(input: RemoteClockInput, user: AuthUser) {
    const employeeId = requireEmployeeId(user);
    const today = manilaToday();
    const declared = await this.declaredFor(employeeId, today);
    const own = await this.prisma.wfhDay.findUnique({ where: { employeeId_date: { employeeId, date: dateKeyToUtcDate(today) } } });
    if (!declared && !own) throw new ForbiddenException('Clocking in from home is only open on remote work days, or after you switch today to working from home.');
    const mine = await this.prisma.remotePunch.findMany({ where: { employeeId, workDate: dateKeyToUtcDate(today), voidedAt: null } });
    if (input.kind === 'in' && mine.some((p) => p.kind === 'in')) throw new ConflictException('You already clocked in today');
    if (input.kind === 'out' && !mine.some((p) => p.kind === 'in')) throw new ConflictException('Clock in first');
    const last = await this.attendance.lastPunchAt(employeeId);
    const now = new Date();
    if (last && now.getTime() - last.getTime() < 60_000) throw new ConflictException(`You already clocked at ${formatTime(last)}. Please wait a minute before trying again.`);
    const reason = declared?.reason ?? 'Working from home';
    const loc = input.location;
    const created = await this.prisma.$transaction(async (tx) => {
      const raw = await tx.rawPunch.create({ data: { deviceSerial: REMOTE_DEVICE_SERIAL, employeeId, punchedAt: now, verifyMode: 'FACE' } });
      const p = await tx.remotePunch.create({
        data: {
          employeeId,
          workDate: dateKeyToUtcDate(today),
          kind: input.kind,
          punchedAt: now,
          match: input.match,
          ...(loc && 'lat' in loc ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy } : loc && 'unavailable' in loc ? { locationNote: loc.unavailable } : {}),
          reason,
          recordedBy: user.displayName,
          rawPunchId: raw.id,
        },
      });
      await this.audit.log({ actorId: user.userId, action: 'REMOTE_CLOCK', entity: 'Employee', entityId: employeeId, after: { kind: input.kind, match: input.match, located: !!(loc && 'lat' in loc) } }, tx);
      return p;
    });
    await this.attendance.recompute(addDays(today, -1), today, [employeeId]);
    return { id: created.id, at: localAt(created.punchedAt), kind: created.kind };
  }
}

@ApiTags('attendance')
@ApiBearerAuth()
// Declaring and cancelling remote work days: HR and the Super Admin.
@Roles('HR_ADMIN', 'SYSTEM_ADMIN')
@Controller('timekeeping')
export class RemoteWorkController {
  constructor(private readonly remote: RemoteWorkService) {}

  @Get('remote')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'remoteWork', summary: 'Remote work days, work-from-home days and home punches in scope' })
  state(@CurrentUser() user: AuthUser) {
    return this.remote.state(user);
  }

  @Post('remote-days')
  @ApiOperation({ operationId: 'declareRemoteDay', summary: 'HR or the Super Admin: declare remote work days for some offices or everyone' })
  @ApiZodBody(RemoteDayInputSchema)
  declare(@CurrentUser() user: AuthUser, @Body(new ZodPipe(RemoteDayInputSchema)) body: RemoteDayInput) {
    return this.remote.declare(body, user);
  }

  @Delete('remote-days/:id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'cancelRemoteDay', summary: 'Cancel remote work days that have not started (or nobody clocked in from home)' })
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.remote.cancel(id, user);
  }

  @Post('wfh')
  @HttpCode(204)
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'setWorkFromHome', summary: 'Work from home today, or switch back to an office day' })
  @ApiZodBody(WfhSchema)
  async wfh(@CurrentUser() user: AuthUser, @Body(new ZodPipe(WfhSchema)) body: WfhInput) {
    await this.remote.setWfh(body.on, user);
  }

  @Post('clock')
  @Roles(...EVERYONE)
  @ApiOperation({ operationId: 'remoteClock', summary: 'Time in or out from home after the face scan (remote work days only)' })
  @ApiZodBody(RemoteClockSchema)
  clock(@CurrentUser() user: AuthUser, @Body(new ZodPipe(RemoteClockSchema)) body: RemoteClockInput) {
    return this.remote.clock(body, user);
  }
}
