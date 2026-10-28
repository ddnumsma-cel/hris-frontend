import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import {
  checkLeaveFiling,
  CreateLeaveRequest,
  LeaveData,
  LeavePersonFacts,
  DateKey,
  dateKeyToUtcDate,
  dateRange,
  Decimal,
  LeaveBalance,
  manilaToday,
  utcDateToDateKey,
} from '@msma/shared';
import { PrismaService } from '../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  async balances(
    employeeId: string,
    year = Number(manilaToday().slice(0, 4)),
  ): Promise<LeaveBalance[]> {
    const rows = await this.prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: true },
    });
    const order = ['VL', 'SL', 'SIL'];
    return rows
      .sort((a, b) => order.indexOf(a.leaveType.code) - order.indexOf(b.leaveType.code))
      .map((b) => ({
        leaveTypeCode: b.leaveType.code,
        leaveTypeName: b.leaveType.name,
        year: b.year,
        entitled: new Decimal(b.entitled.toString()).toFixed(1),
        used: new Decimal(b.used.toString()).toFixed(1),
        remaining: Decimal.max(
          0,
          new Decimal(b.entitled.toString()).minus(b.used.toString()),
        ).toFixed(1),
      }));
  }

  /** Approved and pending leave overlapping [from, to], and this year's remaining days, for these employees. */
  async overview(employeeIds: string[], from: DateKey, to: DateKey) {
    const year = Number(from.slice(0, 4));
    const [requests, balances] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: { in: ['APPROVED', 'PENDING'] },
          startDate: { lte: dateKeyToUtcDate(to) },
          endDate: { gte: dateKeyToUtcDate(from) },
        },
        include: { leaveType: true },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.leaveBalance.findMany({
        where: { employeeId: { in: employeeIds }, year },
        include: { leaveType: true },
      }),
    ]);
    const remaining = new Map<string, Record<string, string>>();
    for (const b of balances) {
      const left = Decimal.max(0, new Decimal(b.entitled.toString()).minus(b.used.toString()));
      remaining.set(b.employeeId, {
        ...(remaining.get(b.employeeId) ?? {}),
        [b.leaveType.code]: left.toFixed(1),
      });
    }
    return {
      upcoming: requests.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        leaveTypeName: r.leaveType.name,
        startDate: utcDateToDateKey(r.startDate),
        endDate: utcDateToDateKey(r.endDate),
        days: new Decimal(r.days.toString()).toFixed(1),
        status: r.status as 'APPROVED' | 'PENDING',
      })),
      remaining,
    };
  }

  /** Dates covered by approved leave, per employee, within [from, to]. */
  async approvedLeaveDays(
    employeeIds: string[],
    from: DateKey,
    to: DateKey,
  ): Promise<Map<string, Set<DateKey>>> {
    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'APPROVED',
        startDate: { lte: dateKeyToUtcDate(to) },
        endDate: { gte: dateKeyToUtcDate(from) },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    });
    const map = new Map<string, Set<DateKey>>();
    for (const r of rows) {
      const set = map.get(r.employeeId) ?? new Set<DateKey>();
      for (const d of dateRange(utcDateToDateKey(r.startDate), utcDateToDateKey(r.endDate)))
        if (d >= from && d <= to) set.add(d);
      map.set(r.employeeId, set);
    }
    return map;
  }

  /** The approved leave covering one date, per employee: its type and last day. */
  async approvedOn(employeeIds: string[], date: DateKey): Promise<Map<string, { leaveType: string; until: DateKey }>> {
    const day = dateKeyToUtcDate(date);
    const rows = await this.prisma.leaveRequest.findMany({
      where: { employeeId: { in: employeeIds }, status: 'APPROVED', startDate: { lte: day }, endDate: { gte: day } },
      select: { employeeId: true, endDate: true, leaveType: { select: { name: true } } },
    });
    return new Map(rows.map((r) => [r.employeeId, { leaveType: r.leaveType.name, until: utcDateToDateKey(r.endDate) }]));
  }

  /** Create a pending leave request after checking the balance. `days` = working days in the range. */
  /**
   * File a leave request, checked with the website's rules (shared leaveRules): days counted on the company calendar,
   * eligibility, the VL/SL pool left this leave year, and overlaps. Returns the days it counts.
   */
  async createRequest(db: Db, employeeId: string, body: CreateLeaveRequest) {
    const type = await db.leaveType.findUnique({ where: { code: body.leaveTypeCode } });
    if (!type || !type.active) throw new NotFoundException('That leave type is not in use');
    const data = await this.ruleData(db, [employeeId]);
    const person = data.people.get(employeeId);
    const { days, errors } = checkLeaveFiling(
      data.rules,
      person,
      { employeeId, typeId: type.id, start: body.startDate, end: body.endDate, halfDay: body.halfDay },
      manilaToday(),
    );
    if (errors.length) throw new BadRequestException(errors.join(' '));
    const request = await db.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: type.id,
        startDate: dateKeyToUtcDate(body.startDate),
        endDate: dateKeyToUtcDate(body.endDate),
        days: new Prisma.Decimal(days),
        reason: body.reason,
      },
    });
    return { request, typeName: type.name, days };
  }

  /** Apply an approval decision to the leave request (and deduct the balance when approved). */
  async decide(db: Db, leaveRequestId: string, status: 'APPROVED' | 'REJECTED') {
    const request = await db.leaveRequest.update({
      where: { id: leaveRequestId },
      data: { status },
    });
    if (status === 'APPROVED') {
      await db.leaveBalance.updateMany({
        where: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year: request.startDate.getUTCFullYear(),
        },
        data: { used: { increment: request.days } },
      });
    }
    return {
      employeeId: request.employeeId,
      from: utcDateToDateKey(request.startDate),
      to: utcDateToDateKey(request.endDate),
    };
  }

  /**
   * What the shared leave rules need for some employees (keyed by their backend id): leave types, every leave
   * request and credit change of theirs, the company holidays, and each person's sex, civil status and hire date.
   */
  async ruleData(db: Db, employeeIds: string[]): Promise<{ rules: LeaveData; people: Map<string, LeavePersonFacts> }> {
    const [types, requests, adjustments, holidays, employees, policyRow, companyRow] = await Promise.all([
      db.leaveType.findMany(),
      db.leaveRequest.findMany({ where: { employeeId: { in: employeeIds } } }),
      db.leaveAdjustment.findMany({ where: { employeeId: { in: employeeIds } } }),
      db.holiday.findMany(),
      db.employee.findMany({ where: { id: { in: employeeIds } } }),
      // Rules › Time off & leave and the company work week (Admin settings › Organization).
      db.appSetting.findUnique({ where: { key: 'leave-policy' } }),
      db.appSetting.findUnique({ where: { key: 'company-settings' } }),
    ]);
    const lower = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled' } as const;
    const civil: Record<string, string> = { SINGLE: 'Single', MARRIED: 'Married', WIDOWED: 'Widowed', SEPARATED: 'Separated', ANNULLED: 'Annulled' };
    const rules: LeaveData = {
      types: types.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        daysPerYear: Number(t.defaultDays.toString()),
        earning: t.earning as LeaveData['types'][number]['earning'],
        paid: t.paid,
        carryOverMax: Number(t.carryOverMax.toString()),
        countBy: t.countBy === 'calendar' ? 'calendar' : 'workdays',
        eligibility: t.eligibility as LeaveData['types'][number]['eligibility'],
        attachmentOver: t.attachmentOver === null ? null : Number(t.attachmentOver.toString()),
        confidential: t.confidential,
        basis: t.basis,
        active: t.active,
      })),
      requests: requests.map((r) => ({ id: r.id, employeeId: r.employeeId, typeId: r.leaveTypeId, start: utcDateToDateKey(r.startDate), end: utcDateToDateKey(r.endDate), days: Number(r.days.toString()), status: lower[r.status] })),
      adjustments: adjustments.map((a) => ({ employeeId: a.employeeId, typeId: a.typeId, days: Number(a.days.toString()), at: a.at.toISOString() })),
      carryOver: {},
      holidays: holidays.map((h) => ({ date: utcDateToDateKey(h.date), name: h.name })),
      ...(policyRow ? { policy: policyRow.value as LeaveData['policy'] } : {}),
      ...((companyRow?.value as { workWeek?: number[] } | null)?.workWeek?.length ? { workWeek: (companyRow!.value as { workWeek: number[] }).workWeek } : {}),
    };
    const people = new Map<string, LeavePersonFacts>(
      employees.map((e) => [
        e.id,
        {
          personal: { sex: e.sex === 'MALE' ? 'Male' : e.sex === 'FEMALE' ? 'Female' : '', civilStatus: e.civilStatus ? civil[e.civilStatus] ?? '' : '' },
          job: { dateHired: utcDateToDateKey(e.hireDate), employmentType: e.status === 'REGULAR' ? 'Regular' : e.status === 'PROBATIONARY' ? 'Probationary' : 'Fixed-term' },
        },
      ]),
    );
    return { rules, people };
  }
}
