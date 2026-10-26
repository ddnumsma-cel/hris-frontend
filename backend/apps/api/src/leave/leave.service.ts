import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import {
  CreateLeaveRequest,
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
  async createRequest(db: Db, employeeId: string, body: CreateLeaveRequest, days: number) {
    if (days <= 0) throw new BadRequestException('The selected dates have no working days');
    const type = await db.leaveType.findUnique({ where: { code: body.leaveTypeCode } });
    if (!type) throw new NotFoundException('Unknown leave type');
    const year = Number(body.startDate.slice(0, 4));
    const balance = await db.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: type.id, year } },
    });
    const remaining = balance
      ? new Decimal(balance.entitled.toString()).minus(balance.used.toString())
      : new Decimal(0);
    if (remaining.lt(days)) {
      throw new BadRequestException(
        `Not enough ${type.name.toLowerCase()}: ${remaining.toFixed(1)} day(s) left, ${days} requested`,
      );
    }
    const overlap = await db.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: dateKeyToUtcDate(body.endDate) },
        endDate: { gte: dateKeyToUtcDate(body.startDate) },
      },
    });
    if (overlap)
      throw new BadRequestException('You already have a leave request for some of these dates');
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
    return { request, typeName: type.name };
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
}
