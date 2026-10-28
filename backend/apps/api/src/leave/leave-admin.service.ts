import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import {
  CREDITS_ADJUSTMENT,
  creditsOf,
  CreditAdjustmentInput,
  fmtCredits,
  LEAVE_CREDITS_PER_YEAR,
  LeaveAdjustmentView,
  LeavePersonFacts,
  LeaveState,
  LeaveTypeRule,
  LeaveTypeView,
  manilaToday,
  SaveLeaveType,
  utcDateToDateKey,
} from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';
import { notSelf } from '../common/not-self';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LeaveService } from './leave.service';

type TypeRow = Prisma.LeaveTypeGetPayload<object>;
const num = (v: Prisma.Decimal | null) => (v === null ? null : Number(v.toString()));
const CIVIL: Record<string, string> = { SINGLE: 'Single', MARRIED: 'Married', WIDOWED: 'Widowed', SEPARATED: 'Separated', ANNULLED: 'Annulled' };
const TYPE: Record<string, string> = { PROBATIONARY: 'Probationary', REGULAR: 'Regular', CONTRACTUAL: 'Fixed-term', PROJECT: 'Fixed-term' };
const STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled' } as const;

export const typeView = (t: TypeRow): LeaveTypeView => ({
  id: t.id,
  name: t.name,
  code: t.code,
  daysPerYear: Number(t.defaultDays.toString()),
  earning: t.earning as LeaveTypeView['earning'],
  paid: t.paid,
  carryOverMax: Number(t.carryOverMax.toString()),
  countBy: t.countBy === 'calendar' ? 'calendar' : 'workdays',
  eligibility: t.eligibility as LeaveTypeView['eligibility'],
  attachmentOver: num(t.attachmentOver),
  confidential: t.confidential,
  basis: t.basis,
  active: t.active,
});

/**
 * Maintenance > Leave on the website: leave types with its rules, HR's VL/SL credit changes, and everything the
 * website needs to show balances (it counts them with the same rules as the backend, shared leaveRules).
 */
@Injectable()
export class LeaveAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly leave: LeaveService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- Leave types ----------

  async types(): Promise<LeaveTypeView[]> {
    const rows = await this.prisma.leaveType.findMany();
    const order = ['VL', 'SL', 'SIL'];
    return rows
      .map(typeView)
      .sort((a, b) => (order.indexOf(a.code) + 1 || 99) - (order.indexOf(b.code) + 1 || 99) || a.name.localeCompare(b.name));
  }

  async saveType(input: SaveLeaveType, user: AuthUser): Promise<LeaveTypeView> {
    const code = input.code.toUpperCase();
    const clash = await this.prisma.leaveType.findFirst({
      where: { id: input.id ? { not: input.id } : undefined, OR: [{ name: { equals: input.name, mode: 'insensitive' } }, { code }] },
    });
    if (clash) throw new ConflictException(clash.code === code ? `The code ${code} is already used by ${clash.name}` : "There's already a leave type with that name");
    const data = {
      name: input.name,
      code,
      defaultDays: input.daysPerYear.toFixed(1),
      earning: input.earning,
      paid: input.paid,
      carryOverMax: input.carryOverMax.toFixed(1),
      countBy: input.countBy,
      eligibility: input.eligibility,
      attachmentOver: input.attachmentOver === null ? null : input.attachmentOver.toFixed(1),
      confidential: input.confidential,
      basis: input.basis,
    };
    const row = await this.prisma.$transaction(async (tx) => {
      if (input.id && !(await tx.leaveType.findUnique({ where: { id: input.id } }))) throw new NotFoundException('That leave type no longer exists');
      const r = input.id ? await tx.leaveType.update({ where: { id: input.id }, data }) : await tx.leaveType.create({ data });
      await this.audit.log({ actorId: user.userId, action: input.id ? 'LEAVE_TYPE_CHANGED' : 'LEAVE_TYPE_ADDED', entity: 'LeaveType', entityId: r.id, after: { ...input, code } }, tx);
      return r;
    });
    return typeView(row);
  }

  async setTypeActive(id: string, active: boolean, user: AuthUser): Promise<void> {
    const t = await this.prisma.leaveType.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('That leave type no longer exists');
    await this.prisma.$transaction(async (tx) => {
      await tx.leaveType.update({ where: { id }, data: { active } });
      await this.audit.log({ actorId: user.userId, action: active ? 'LEAVE_TYPE_TURNED_ON' : 'LEAVE_TYPE_TURNED_OFF', entity: 'LeaveType', entityId: id, after: { name: t.name, active } }, tx);
    });
  }

  // ---------- What the website shows (employees by employee number) ----------

  /** HR, payroll and System Admin see everyone; a manager their team and themselves; anyone else themselves. */
  async state(user: AuthUser, teamIds?: string[]): Promise<LeaveState> {
    const all = user.role === 'HR_ADMIN' || user.role === 'SYSTEM_ADMIN' || user.role === 'PAYROLL_ADMIN';
    const ids = all ? undefined : [...(teamIds ?? []), ...(user.employeeId ? [user.employeeId] : [])];
    const [types, employees, requests, adjustments] = await Promise.all([
      this.types(),
      this.prisma.employee.findMany({ where: { active: true, ...(ids ? { id: { in: ids } } : {}) }, include: { site: true, department: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
      this.prisma.leaveRequest.findMany({
        where: ids ? { employeeId: { in: ids } } : {},
        include: { employee: { select: { employeeNo: true, firstName: true, lastName: true } }, approval: { include: { decidedBy: { select: { displayName: true } } } } },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.leaveAdjustment.findMany({ where: ids ? { employeeId: { in: ids } } : {}, include: { employee: { select: { employeeNo: true } } }, orderBy: { at: 'desc' } }),
    ]);
    const policyRow = await this.prisma.appSetting.findUnique({ where: { key: 'leave-policy' } });
    return {
      ...(policyRow ? { policy: policyRow.value as LeaveState['policy'] } : {}),
      types,
      requests: requests.map((r) => ({
        id: r.approval?.id ?? r.id,
        employeeId: r.employee.employeeNo,
        typeId: r.leaveTypeId,
        start: utcDateToDateKey(r.startDate),
        end: utcDateToDateKey(r.endDate),
        days: Number(r.days.toString()),
        // Accounting counts leave days for pay; why someone filed it isn't theirs to read.
        reason: user.role === 'PAYROLL_ADMIN' ? '' : r.reason,
        status: STATUS[r.status],
        filedBy: `${r.employee.firstName} ${r.employee.lastName}`,
        filedAt: r.createdAt.toISOString(),
        ...(r.approval?.decidedBy ? { decidedBy: r.approval.decidedBy.displayName } : {}),
        ...(r.approval?.decidedAt ? { decidedAt: r.approval.decidedAt.toISOString() } : {}),
        ...(r.approval?.reason ? { note: r.approval.reason } : {}),
      })),
      adjustments: adjustments.map((a) => this.adjustmentView(a, a.employee.employeeNo)),
      carryOver: {},
      people: Object.fromEntries(
        employees.map((e) => [
          e.employeeNo,
          { name: `${e.firstName} ${e.lastName}`, departmentName: e.department?.name ?? '', branch: e.site.name, sex: e.sex === 'MALE' ? 'Male' : e.sex === 'FEMALE' ? 'Female' : '', civilStatus: e.civilStatus ? CIVIL[e.civilStatus] ?? '' : '', employmentType: TYPE[e.status] ?? 'Regular', dateHired: utcDateToDateKey(e.hireDate) },
        ]),
      ),
    };
  }

  private adjustmentView(a: Prisma.LeaveAdjustmentGetPayload<object>, employeeNo: string): LeaveAdjustmentView {
    return { id: a.id, employeeId: employeeNo, typeId: a.typeId, days: Number(a.days.toString()), reason: a.reason, by: a.by, at: a.at.toISOString() };
  }

  // ---------- HR changes someone's VL/SL days ----------

  async adjustCredits(input: CreditAdjustmentInput, user: AuthUser): Promise<LeaveAdjustmentView> {
    if (Math.abs(input.leaves) > LEAVE_CREDITS_PER_YEAR) throw new BadRequestException(`Change at most ${LEAVE_CREDITS_PER_YEAR} days at a time`);
    const e = await this.prisma.employee.findUnique({ where: { employeeNo: input.employeeId } });
    if (!e) throw new NotFoundException('That employee no longer exists');
    notSelf(user, e.id, 'adjust leave credits');
    const data = await this.leave.ruleData(this.prisma, [e.id]);
    const credits = creditsOf(data.rules, e.id, manilaToday(), data.people.get(e.id)?.job.dateHired);
    if (credits.available + input.leaves < 0) throw new BadRequestException(`They only have ${fmtCredits(credits.available)} left`);
    const row = await this.prisma.$transaction(async (tx) => {
      const a = await tx.leaveAdjustment.create({ data: { employeeId: e.id, typeId: CREDITS_ADJUSTMENT, days: input.leaves.toFixed(1), reason: input.reason, by: user.displayName } });
      await this.audit.log({ actorId: user.userId, action: 'LEAVE_CREDITS_ADJUSTED', entity: 'Employee', entityId: e.id, after: { employeeNo: input.employeeId, days: input.leaves, reason: input.reason } }, tx);
      return a;
    });
    const n = Math.abs(input.leaves);
    await this.notifications.send({ topic: 'leave', kind: 'update', title: input.leaves > 0 ? `${n} ${n === 1 ? 'day' : 'days'} added to your leave balance` : `${n} ${n === 1 ? 'day' : 'days'} taken from your leave balance`, body: `${user.displayName}: "${input.reason}"`, employeeIds: [e.id], actorId: user.userId });
    return this.adjustmentView(row, input.employeeId);
  }
}

export type { LeavePersonFacts, LeaveTypeRule };
