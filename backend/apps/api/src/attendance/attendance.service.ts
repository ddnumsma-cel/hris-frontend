import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VerifyMode } from '@msma/db';
import {
  addDays,
  AttendanceDaysResponse,
  computeDailyTimeRecord,
  DateKey,
  dateKeyToUtcDate,
  dateRange,
  DtrRow,
  DtrStatus,
  fromManila,
  HolidayInfo,
  manilaDateKey,
  manilaToday,
  MeToday,
  shiftBounds,
  utcDateToDateKey,
  weekdayOf,
} from '@msma/shared';
import { EmployeesService } from '../employees/employees.service';
import { LeaveService } from '../leave/leave.service';
import { PrismaService } from '../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;
const DAY_MS = 86_400_000;

export interface PunchInput {
  employeeId: string;
  deviceSerial: string;
  punchedAt: Date;
  verifyMode: VerifyMode;
}

export interface DayCounts {
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  scheduled: number;
}

const toRow = (r: {
  date: Date;
  timeIn: Date | null;
  timeOut: Date | null;
  workedMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
  otMinutes: number;
  nightDiffMinutes: number;
  status: DtrStatus;
  remarks: string | null;
}): DtrRow => ({
  date: utcDateToDateKey(r.date),
  timeIn: r.timeIn?.toISOString() ?? null,
  timeOut: r.timeOut?.toISOString() ?? null,
  workedMinutes: r.workedMinutes,
  lateMinutes: r.lateMinutes,
  undertimeMinutes: r.undertimeMinutes,
  otMinutes: r.otMinutes,
  nightDiffMinutes: r.nightDiffMinutes,
  status: r.status,
  remarks: r.remarks,
});

/** Punches, daily time records, holidays, OT requests and DTR corrections. */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly leave: LeaveService,
  ) {}

  // ---------- Calendar ----------

  async holidayMap(from: DateKey, to: DateKey): Promise<Map<DateKey, HolidayInfo>> {
    const rows = await this.prisma.holiday.findMany({
      where: { date: { gte: dateKeyToUtcDate(from), lte: dateKeyToUtcDate(to) } },
    });
    return new Map(rows.map((h) => [utcDateToDateKey(h.date), { name: h.name, type: h.type }]));
  }

  /** Mon–Sat working days in [from, to], excluding holidays. */
  async countWorkingDays(
    from: DateKey,
    to: DateKey,
    workDays = [1, 2, 3, 4, 5, 6],
  ): Promise<number> {
    const holidays = await this.holidayMap(from, to);
    return dateRange(from, to).filter((d) => workDays.includes(weekdayOf(d)) && !holidays.has(d))
      .length;
  }

  // ---------- Punches ----------

  /** Store punches idempotently (duplicates are ignored) and recompute the affected days. */
  async recordPunches(punches: PunchInput[]): Promise<{ received: number; inserted: number }> {
    if (!punches.length) return { received: 0, inserted: 0 };
    const { count } = await this.prisma.rawPunch.createMany({
      data: punches,
      skipDuplicates: true,
    });
    const days = new Map<string, Set<DateKey>>();
    for (const p of punches) {
      const d = manilaDateKey(p.punchedAt);
      const set = days.get(p.employeeId) ?? new Set<DateKey>();
      set.add(d).add(addDays(d, -1)); // a punch after midnight can close the previous day's shift
      days.set(p.employeeId, set);
    }
    for (const [employeeId, set] of days) {
      const sorted = [...set].sort();
      await this.recompute(sorted[0], sorted[sorted.length - 1], [employeeId]);
    }
    return { received: punches.length, inserted: count };
  }

  async lastPunchAt(employeeId: string): Promise<Date | null> {
    const p = await this.prisma.rawPunch.findFirst({
      where: { employeeId },
      orderBy: { punchedAt: 'desc' },
      select: { punchedAt: true },
    });
    return p?.punchedAt ?? null;
  }

  /** Most recent punches, with IN/OUT and lateness taken from the computed DTR. */
  async latestPunches(limit: number, siteId?: string) {
    const directory = await this.employees.directory(siteId);
    const rows = await this.prisma.rawPunch.findMany({
      where: siteId ? { employeeId: { in: [...directory.keys()] } } : {},
      orderBy: { punchedAt: 'desc' },
      take: limit,
    });
    const dtrs = await this.prisma.dailyTimeRecord.findMany({
      where: {
        OR: rows.map((r) => ({
          employeeId: r.employeeId,
          date: dateKeyToUtcDate(manilaDateKey(new Date(r.punchedAt.getTime() - 4 * 3_600_000))),
        })),
      },
    });
    const dtrByKey = new Map(dtrs.map((d) => [`${d.employeeId}|${utcDateToDateKey(d.date)}`, d]));
    return rows.map((r) => {
      const dtr = dtrByKey.get(
        `${r.employeeId}|${manilaDateKey(new Date(r.punchedAt.getTime() - 4 * 3_600_000))}`,
      );
      const isIn = !dtr?.timeIn || dtr.timeIn.getTime() === r.punchedAt.getTime();
      const who = directory.get(r.employeeId);
      return {
        id: r.id,
        punchedAt: r.punchedAt.toISOString(),
        employeeId: r.employeeId,
        employeeName: who?.name ?? 'Unknown',
        siteName: who?.siteName ?? '',
        deviceSerial: r.deviceSerial,
        method: r.verifyMode,
        kind: isIn ? ('IN' as const) : ('OUT' as const),
        lateMinutes: isIn ? (dtr?.lateMinutes ?? 0) : 0,
      };
    });
  }

  // ---------- Daily time records ----------

  /**
   * Recompute DTRs for [from, to] (clamped to today) from raw punches, holidays, approved leave and
   * approved DTR corrections. DTRs are derived data, so rows in the range are replaced.
   */
  async recompute(
    from: DateKey,
    to: DateKey,
    employeeIds?: string[],
  ): Promise<{ employees: number; records: number }> {
    const today = manilaToday();
    if (to > today) to = today;
    if (from > to) return { employees: 0, records: 0 };

    const employees = await this.employees.forCompute(employeeIds ? { ids: employeeIds } : {});
    const ids = employees.map((e) => e.id);
    const [holidays, leaveDays, corrections, punches, undertimes] = await Promise.all([
      this.holidayMap(from, to),
      this.leave.approvedLeaveDays(ids, from, to),
      this.prisma.dtrCorrection.findMany({
        where: {
          employeeId: { in: ids },
          status: 'APPROVED',
          date: { gte: dateKeyToUtcDate(from), lte: dateKeyToUtcDate(to) },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.rawPunch.findMany({
        where: {
          employeeId: { in: ids },
          punchedAt: {
            gte: new Date(fromManila(from).getTime() - DAY_MS),
            lt: fromManila(addDays(to, 2)),
          },
        },
        select: { employeeId: true, punchedAt: true },
      }),
      this.prisma.undertimeRequest.findMany({
        where: {
          employeeId: { in: ids },
          status: 'APPROVED',
          date: { gte: dateKeyToUtcDate(from), lte: dateKeyToUtcDate(to) },
        },
        select: { employeeId: true, date: true },
      }),
    ]);
    const approvedUndertime = new Set(
      undertimes.map((u) => `${u.employeeId}|${utcDateToDateKey(u.date)}`),
    );

    const punchesByEmployee = new Map<string, Date[]>();
    for (const p of punches) {
      const list = punchesByEmployee.get(p.employeeId) ?? [];
      list.push(p.punchedAt);
      punchesByEmployee.set(p.employeeId, list);
    }
    // Approved time adjustments per day. A later approval wins for the same field.
    const fixes = new Map<string, { timeIn: Date | null; timeOut: Date | null }>();
    for (const c of corrections) {
      const key = `${c.employeeId}|${utcDateToDateKey(c.date)}`;
      const prev = fixes.get(key);
      fixes.set(key, {
        timeIn: c.requestedTimeIn ?? prev?.timeIn ?? null,
        timeOut: c.requestedTimeOut ?? prev?.timeOut ?? null,
      });
    }
    /**
     * Punches used for one day. An approved time adjustment replaces that day's time in / time out: clock
     * punches before the corrected time in, or after the corrected time out, no longer count for that day.
     * The raw punches themselves are kept (append-only).
     */
    const punchesFor = (e: (typeof employees)[number], date: DateKey) => {
      const all = punchesByEmployee.get(e.id) ?? [];
      const fix = fixes.get(`${e.id}|${date}`);
      if (!fix) return { punches: all, corrected: false };
      const { windowStart, windowEnd } = shiftBounds(date, e.shift);
      const kept = all.filter((p) => {
        if (p < windowStart || p >= windowEnd) return true; // another day's punch
        if (fix.timeIn && p < fix.timeIn) return false;
        if (fix.timeOut && p > fix.timeOut) return false;
        return true;
      });
      const added = [fix.timeIn, fix.timeOut].filter((t): t is Date => !!t);
      return { punches: [...kept, ...added], corrected: true };
    };

    const rows: Prisma.DailyTimeRecordCreateManyInput[] = [];
    for (const e of employees) {
      const start = e.hireDate > from ? e.hireDate : from;
      for (const date of dateRange(start, to)) {
        const day = punchesFor(e, date);
        const r = computeDailyTimeRecord({
          date,
          punches: day.punches,
          shift: e.shift,
          holiday: holidays.get(date) ?? null,
          onLeave: leaveDays.get(e.id)?.has(date) ?? false,
        });
        const corrected = day.corrected
          ? [r.remarks?.replace('MISSING_TIME_OUT', '').replace(/^; |; $/g, ''), 'CORRECTED']
              .filter(Boolean)
              .join('; ')
          : r.remarks;
        // Approved undertime is still unpaid, but it is excused: HR sees it was allowed.
        const remarks =
          r.undertimeMinutes > 0 && approvedUndertime.has(`${e.id}|${date}`)
            ? [corrected, 'UNDERTIME_APPROVED'].filter(Boolean).join('; ')
            : corrected;
        rows.push({
          employeeId: e.id,
          date: dateKeyToUtcDate(date),
          timeIn: r.timeIn,
          timeOut: r.timeOut,
          workedMinutes: r.workedMinutes,
          lateMinutes: r.lateMinutes,
          undertimeMinutes: r.undertimeMinutes,
          otMinutes: r.otMinutes,
          nightDiffMinutes: r.nightDiffMinutes,
          status: r.status,
          remarks: remarks || null,
        });
      }
    }

    await this.prisma.$transaction([
      this.prisma.dailyTimeRecord.deleteMany({
        where: {
          employeeId: { in: ids },
          date: { gte: dateKeyToUtcDate(from), lte: dateKeyToUtcDate(to) },
        },
      }),
      this.prisma.dailyTimeRecord.createMany({ data: rows }),
    ]);
    return { employees: employees.length, records: rows.length };
  }

  /** Make sure a day has DTRs (e.g. the first dashboard load of a new day). */
  async ensureDay(date: DateKey) {
    const count = await this.prisma.dailyTimeRecord.count({
      where: { date: dateKeyToUtcDate(date) },
    });
    if (count === 0) await this.recompute(date, date);
  }

  async dtrs(employeeId: string, from: DateKey, to: DateKey): Promise<DtrRow[]> {
    const rows = await this.prisma.dailyTimeRecord.findMany({
      where: { employeeId, date: { gte: dateKeyToUtcDate(from), lte: dateKeyToUtcDate(to) } },
      orderBy: { date: 'desc' },
    });
    return rows.map(toRow);
  }

  /** The last `count` DTRs up to today (newest first). */
  async recentDtrs(employeeId: string, count = 14): Promise<DtrRow[]> {
    const today = manilaToday();
    const rows = await this.dtrs(employeeId, addDays(today, -40), today);
    return rows.slice(0, count);
  }

  async dtrsForEmployees(
    ids: string[],
    from: DateKey,
    to: DateKey,
  ): Promise<Map<string, DtrRow[]>> {
    const rows = await this.prisma.dailyTimeRecord.findMany({
      where: {
        employeeId: { in: ids },
        date: { gte: dateKeyToUtcDate(from), lte: dateKeyToUtcDate(to) },
      },
      orderBy: { date: 'asc' },
    });
    const map = new Map<string, DtrRow[]>();
    for (const r of rows) map.set(r.employeeId, [...(map.get(r.employeeId) ?? []), toRow(r)]);
    return map;
  }

  /**
   * HR's attendance log: each person's daily time records from `from` to `to` with the raw punches behind each day
   * (grouped by the Manila date they were made on), plus everyone's shift. `scope` limits it to a manager's team.
   */
  async days(from: DateKey, to: DateKey, scope?: string[], employeeId?: string): Promise<AttendanceDaysResponse> {
    const ids = employeeId ? (scope && !scope.includes(employeeId) ? [] : [employeeId]) : scope;
    const employees = await this.employees.forCompute(ids ? { ids } : {});
    const inScope = employees.map((e) => e.id);
    const [dtrs, punches] = await Promise.all([
      this.prisma.dailyTimeRecord.findMany({
        where: {
          employeeId: { in: inScope },
          date: { gte: dateKeyToUtcDate(from), lte: dateKeyToUtcDate(to) },
        },
        orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
      }),
      this.prisma.rawPunch.findMany({
        where: {
          employeeId: { in: inScope },
          punchedAt: { gte: fromManila(from), lt: fromManila(addDays(to, 1)) },
        },
        orderBy: { punchedAt: 'asc' },
      }),
    ]);
    const approvedOt = await this.approvedOtMinutes(inScope, from, to);
    const byDay = new Map<string, typeof punches>();
    for (const p of punches) {
      const key = `${p.employeeId}|${manilaDateKey(p.punchedAt)}`;
      byDay.set(key, [...(byDay.get(key) ?? []), p]);
    }
    return {
      employees: employees.map((e) => ({
        id: e.id,
        shift: {
          id: e.shift.id,
          code: e.shift.code,
          name: e.shift.name,
          startTime: e.shift.startTime,
          endTime: e.shift.endTime,
          breakMinutes: e.shift.breakMinutes,
          graceMinutes: e.shift.graceMinutes ?? 0,
          workDays: e.shift.workDays,
          breakStart: e.shift.breakStart ?? null,
          flexible: e.shift.flexible ?? false,
          requiredMinutes: e.shift.requiredMinutes ?? null,
          saturdayEnd: null,
          active: true,
          people: 0,
        },
      })),
      days: dtrs.map((r) => ({
        ...toRow(r),
        employeeId: r.employeeId,
        approvedOtMinutes: Math.min(r.otMinutes, approvedOt.get(`${r.employeeId}|${utcDateToDateKey(r.date)}`) ?? 0),
        punches: (byDay.get(`${r.employeeId}|${utcDateToDateKey(r.date)}`) ?? []).map((p) => ({
          id: p.id,
          punchedAt: p.punchedAt.toISOString(),
          verifyMode: p.verifyMode,
          deviceSerial: p.deviceSerial,
        })),
      })),
    };
  }

  async statusForDate(ids: string[], date: DateKey): Promise<Map<string, DtrStatus>> {
    const rows = await this.prisma.dailyTimeRecord.findMany({
      where: { employeeId: { in: ids }, date: dateKeyToUtcDate(date) },
      select: { employeeId: true, status: true },
    });
    return new Map(rows.map((r) => [r.employeeId, r.status]));
  }

  /** For the employee list: each person's time-in and minutes late on a date, and the approved leave covering it. */
  async dayDetails(
    ids: string[],
    date: DateKey,
  ): Promise<Map<string, { timeIn: string | null; lateMinutes: number; leaveType: string | null; leaveUntil: DateKey | null }>> {
    const [rows, leaves] = await Promise.all([
      this.prisma.dailyTimeRecord.findMany({
        where: { employeeId: { in: ids }, date: dateKeyToUtcDate(date) },
        select: { employeeId: true, timeIn: true, lateMinutes: true },
      }),
      this.leave.approvedOn(ids, date),
    ]);
    const byId = new Map(rows.map((r) => [r.employeeId, r]));
    const out = new Map<string, { timeIn: string | null; lateMinutes: number; leaveType: string | null; leaveUntil: DateKey | null }>();
    for (const id of ids) {
      const r = byId.get(id);
      const l = leaves.get(id);
      if (!r && !l) continue;
      out.set(id, { timeIn: r?.timeIn?.toISOString() ?? null, lateMinutes: r?.lateMinutes ?? 0, leaveType: l?.leaveType ?? null, leaveUntil: l?.until ?? null });
    }
    return out;
  }

  private tally(rows: { status: DtrStatus; lateMinutes: number }[]): DayCounts {
    const c: DayCounts = { present: 0, late: 0, absent: 0, onLeave: 0, scheduled: 0 };
    for (const r of rows) {
      if (r.status === 'PRESENT') {
        c.present++;
        if (r.lateMinutes > 0) c.late++;
      } else if (r.status === 'ABSENT') c.absent++;
      else if (r.status === 'LEAVE') c.onLeave++;
    }
    c.scheduled = c.present + c.absent;
    return c;
  }

  /** Attendance counts for one date: overall (optionally one site) and per site. */
  async dayCounts(
    date: DateKey,
    siteId?: string,
  ): Promise<{ total: DayCounts; bySite: Map<string, DayCounts> }> {
    const directory = await this.employees.directory();
    const rows = await this.prisma.dailyTimeRecord.findMany({
      where: { date: dateKeyToUtcDate(date) },
      select: { employeeId: true, status: true, lateMinutes: true },
    });
    const bySiteRows = new Map<string, typeof rows>();
    for (const r of rows) {
      const site = directory.get(r.employeeId)?.siteId;
      if (!site) continue;
      bySiteRows.set(site, [...(bySiteRows.get(site) ?? []), r]);
    }
    const bySite = new Map([...bySiteRows].map(([site, list]) => [site, this.tally(list)]));
    const total = this.tally(
      siteId ? (bySiteRows.get(siteId) ?? []) : rows.filter((r) => directory.has(r.employeeId)),
    );
    return { total, bySite };
  }

  /** Attendance rate for the last `days` working days ending at `endDate`. */
  async trend(endDate: DateKey, days: number, siteId?: string) {
    const directory = await this.employees.directory(siteId);
    const rows = await this.prisma.dailyTimeRecord.groupBy({
      by: ['date', 'status'],
      where: {
        date: {
          gte: dateKeyToUtcDate(addDays(endDate, -days * 2 - 7)),
          lte: dateKeyToUtcDate(endDate),
        },
        status: { in: ['PRESENT', 'ABSENT'] },
        ...(siteId ? { employeeId: { in: [...directory.keys()] } } : {}),
      },
      _count: { _all: true },
    });
    const byDate = new Map<DateKey, { present: number; absent: number }>();
    for (const r of rows) {
      const d = utcDateToDateKey(r.date);
      const entry = byDate.get(d) ?? { present: 0, absent: 0 };
      if (r.status === 'PRESENT') entry.present += r._count._all;
      else entry.absent += r._count._all;
      byDate.set(d, entry);
    }
    return [...byDate]
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([d]) => weekdayOf(d) !== 0) // Sunday rest-day work is not part of the trend
      .slice(-days)
      .map(([date, v]) => {
        const scheduled = v.present + v.absent;
        return {
          date,
          present: v.present,
          scheduled,
          rate: scheduled ? Math.round((v.present / scheduled) * 1000) / 10 : 0,
        };
      });
  }

  /** DTRs with a missing time-out in [from, to] (today excluded: people are still at work). */
  async missingTimeOutCount(from: DateKey, to: DateKey, siteId?: string): Promise<number> {
    const end = to >= manilaToday() ? addDays(manilaToday(), -1) : to;
    if (end < from) return 0;
    const ids = siteId ? [...(await this.employees.directory(siteId)).keys()] : undefined;
    return this.prisma.dailyTimeRecord.count({
      where: {
        date: { gte: dateKeyToUtcDate(from), lte: dateKeyToUtcDate(end) },
        remarks: { contains: 'MISSING_TIME_OUT' },
        ...(ids ? { employeeId: { in: ids } } : {}),
      },
    });
  }

  // ---------- Employee self-service ----------

  /** Today's shift and clock status for one employee (live from punches). */
  async today(employeeId: string, now: Date = new Date()): Promise<MeToday> {
    const e = await this.employees.forComputeOne(employeeId);
    const calendarDay = manilaDateKey(now);
    // Before the shift window opens (e.g. 01:00) the current shift is still yesterday's.
    const date =
      now < shiftBounds(calendarDay, e.shift).windowStart ? addDays(calendarDay, -1) : calendarDay;
    const { windowStart, windowEnd } = shiftBounds(date, e.shift);
    const [holidays, leaveDays, punches] = await Promise.all([
      this.holidayMap(date, date),
      this.leave.approvedLeaveDays([employeeId], date, date),
      this.prisma.rawPunch.findMany({
        where: { employeeId, punchedAt: { gte: windowStart, lt: windowEnd } },
        select: { punchedAt: true },
      }),
    ]);
    const holiday = holidays.get(date) ?? null;
    const onLeave = leaveDays.get(employeeId)?.has(date) ?? false;
    const r = computeDailyTimeRecord({
      date,
      punches: punches.map((p) => p.punchedAt),
      shift: e.shift,
      holiday,
      onLeave,
    });
    const isWorkday = e.shift.workDays.includes(weekdayOf(date)) && !holiday;
    const status: MeToday['status'] = r.timeIn
      ? r.timeOut
        ? 'CLOCKED_OUT'
        : 'CLOCKED_IN'
      : onLeave
        ? 'ON_LEAVE'
        : holiday
          ? 'HOLIDAY'
          : !isWorkday
            ? 'REST_DAY'
            : 'NOT_CLOCKED_IN';
    return {
      date,
      shift: { name: e.shift.name, startTime: e.shift.startTime, endTime: e.shift.endTime },
      isWorkday,
      holiday: holiday ? { name: holiday.name, type: holiday.type } : null,
      onLeave,
      timeIn: r.timeIn?.toISOString() ?? null,
      timeOut: r.timeOut?.toISOString() ?? null,
      lateMinutes: r.lateMinutes,
      status,
      nextAction: r.timeIn ? 'CLOCK_OUT' : 'CLOCK_IN',
      siteName: e.siteName,
    };
  }

  // ---------- OT requests and DTR corrections (decided via approvals) ----------

  async decideOt(db: Db, otRequestId: string, status: 'APPROVED' | 'REJECTED') {
    const r = await db.otRequest.update({ where: { id: otRequestId }, data: { status } });
    return { employeeId: r.employeeId, date: utcDateToDateKey(r.date) };
  }

  async decideUndertime(db: Db, undertimeId: string, status: 'APPROVED' | 'REJECTED') {
    const r = await db.undertimeRequest
      .update({ where: { id: undertimeId }, data: { status } })
      .catch(() => {
        throw new NotFoundException('Undertime request not found');
      });
    return { employeeId: r.employeeId, date: utcDateToDateKey(r.date) };
  }

  /** Approved overtime minutes per "employeeId|date". Payroll pays overtime only when it was approved. */
  async approvedOtMinutes(ids: string[], from: DateKey, to: DateKey): Promise<Map<string, number>> {
    const rows = await this.prisma.otRequest.findMany({
      where: {
        employeeId: { in: ids },
        status: 'APPROVED',
        date: { gte: dateKeyToUtcDate(from), lte: dateKeyToUtcDate(to) },
      },
      select: { employeeId: true, date: true, minutes: true },
    });
    const out = new Map<string, number>();
    for (const r of rows) {
      const key = `${r.employeeId}|${utcDateToDateKey(r.date)}`;
      out.set(key, (out.get(key) ?? 0) + r.minutes);
    }
    return out;
  }

  async decideCorrection(db: Db, correctionId: string, status: 'APPROVED' | 'REJECTED') {
    const r = await db.dtrCorrection
      .update({ where: { id: correctionId }, data: { status } })
      .catch(() => {
        throw new NotFoundException('DTR correction not found');
      });
    return { employeeId: r.employeeId, date: utcDateToDateKey(r.date) };
  }
}
