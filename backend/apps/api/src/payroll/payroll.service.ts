import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  computePayslip,
  Cutoff,
  DateKey,
  dateKeyToUtcDate,
  formatDate,
  formatDateRange,
  manilaToday,
  moneyString,
  parseCutoff,
  PayrollDay,
  PayrollPreview,
  PayrollPreviewLine,
  PayslipView,
  StatutoryRates,
  sumMoney,
  utcDateToDateKey,
  weekdayOf,
} from '@msma/shared';
import { AttendanceService } from '../attendance/attendance.service';
import { EmployeesService } from '../employees/employees.service';
import { PrismaService } from '../prisma/prisma.service';

const RATE_KEYS = {
  SSS: 'sss',
  PHILHEALTH: 'philhealth',
  PAGIBIG: 'pagibig',
  WITHHOLDING_TAX: 'withholdingTax',
} as const;

/** SAMPLE payroll preview. Rates are approximate and unverified. Never use for real pay. */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly attendance: AttendanceService,
  ) {}

  /** Statutory tables in effect on a date (latest effectiveFrom ≤ date per table). */
  async ratesAsOf(date: DateKey) {
    const rows = await this.prisma.statutoryRate.findMany({
      where: { effectiveFrom: { lte: dateKeyToUtcDate(date) } },
      orderBy: { effectiveFrom: 'desc' },
    });
    const rates: Partial<StatutoryRates> = {};
    const info: PayrollPreview['rates'] = [];
    for (const [name, key] of Object.entries(RATE_KEYS)) {
      const row = rows.find((r) => r.name === name);
      if (!row)
        throw new InternalServerErrorException(`Statutory rate table ${name} is not configured`);
      const cfg = row.config as unknown as StatutoryRates[typeof key];
      (rates as Record<string, unknown>)[key] = cfg;
      info.push({
        name,
        effectiveFrom: utcDateToDateKey(row.effectiveFrom),
        verified: cfg.verified === true,
        source: cfg.source,
      });
    }
    return { rates: rates as StatutoryRates, info };
  }

  private parse(code: string): Cutoff {
    try {
      return parseCutoff(code);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  async preview(cutoffCode: string, siteId?: string): Promise<PayrollPreview> {
    const cutoff = this.parse(cutoffCode);
    const today = manilaToday();
    const upTo = cutoff.to < today ? cutoff.to : today;
    const { rates, info } = await this.ratesAsOf(cutoff.from);
    const employees = (await this.employees.forCompute({ siteId })).filter(
      (e) => e.hireDate <= cutoff.to,
    );
    const ids = employees.map((e) => e.id);
    const [dtrs, holidays, approvedOt] = await Promise.all([
      this.attendance.dtrsForEmployees(ids, cutoff.from, upTo),
      this.attendance.holidayMap(cutoff.from, cutoff.to),
      this.attendance.approvedOtMinutes(ids, cutoff.from, upTo),
    ]);

    const lines: PayrollPreviewLine[] = employees.map((e) => {
      const days: PayrollDay[] = (dtrs.get(e.id) ?? []).map((d) => ({
        date: d.date,
        status: d.status,
        restDay: !e.shift.workDays.includes(weekdayOf(d.date)),
        workedMinutes: d.workedMinutes,
        holidayType: holidays.get(d.date)?.type ?? null,
        paidLeave: true,
        lateMinutes: d.lateMinutes,
        undertimeMinutes: d.undertimeMinutes,
        // Overtime is paid only when approved, and never more than the time clock shows.
        otMinutes: Math.min(d.otMinutes, approvedOt.get(`${e.id}|${d.date}`) ?? 0),
        nightDiffMinutes: d.nightDiffMinutes,
      }));
      const p = computePayslip({
        monthlySalary: e.monthlySalary,
        days,
        rates,
        cutoff: { from: cutoff.from, to: cutoff.to },
        hireDate: e.hireDate,
        separationDate: e.separationDate,
        workDays: e.shift.workDays,
      });
      return {
        employeeId: e.id,
        employeeNo: e.employeeNo,
        fullName: e.fullName,
        siteName: e.siteName,
        dailyRate: moneyString(e.dailyRate),
        otMinutes: p.otMinutes,
        nightDiffMinutes: p.nightDiffMinutes,
        daysPaid: p.daysPaid.toFixed(1),
        basicPay: moneyString(p.basicPay),
        overtimePay: moneyString(p.overtimePay),
        nightDiffPay: moneyString(p.nightDiffPay),
        holidayPay: moneyString(p.holidayPay),
        lateUndertimeDeduction: moneyString(p.lateUndertimeDeduction),
        grossPay: moneyString(p.grossPay),
        sss: moneyString(p.sss),
        philhealth: moneyString(p.philhealth),
        pagibig: moneyString(p.pagibig),
        withholdingTax: moneyString(p.withholdingTax),
        totalDeductions: moneyString(p.totalDeductions),
        netPay: moneyString(p.netPay),
      };
    });

    const ratesVerified = info.every((r) => r.verified);
    return {
      sample: true,
      notice:
        `SAMPLE: rates not yet verified. Computed from DTRs ${formatDateRange(cutoff.from, upTo)}` +
        (upTo < cutoff.to ? ` (cutoff runs to ${formatDate(cutoff.to)}).` : '.') +
        ' Not for actual payroll.',
      cutoff: cutoff.code,
      label: cutoff.label,
      ratesVerified,
      rates: info,
      totals: {
        employees: lines.length,
        gross: moneyString(sumMoney(lines.map((l) => l.grossPay))),
        deductions: moneyString(sumMoney(lines.map((l) => l.totalDeductions))),
        net: moneyString(sumMoney(lines.map((l) => l.netPay))),
      },
      lines,
    };
  }

  /** The employee's most recent released payslip. */
  async latestPayslip(employeeId: string): Promise<PayslipView> {
    const p = await this.prisma.payslip.findFirst({
      where: { employeeId, payrollRun: { status: 'RELEASED' } },
      orderBy: { payrollRun: { cutoffTo: 'desc' } },
      include: { payrollRun: true, employee: true },
    });
    if (!p) throw new NotFoundException('No released payslip yet');
    const from = utcDateToDateKey(p.payrollRun.cutoffFrom);
    const to = utcDateToDateKey(p.payrollRun.cutoffTo);
    const m = (v: { toString(): string }) => moneyString(v.toString());
    return {
      id: p.id,
      employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
      cutoffFrom: from,
      cutoffTo: to,
      label: formatDateRange(from, to),
      payDate: utcDateToDateKey(p.payrollRun.payDate),
      status: p.payrollRun.status,
      daysPaid: Number(p.daysPaid.toString()).toFixed(1),
      basicPay: m(p.basicPay),
      overtimePay: m(p.overtimePay),
      nightDiffPay: m(p.nightDiffPay),
      holidayPay: m(p.holidayPay),
      lateUndertimeDeduction: m(p.lateUndertimeDeduction),
      grossPay: m(p.grossPay),
      sss: m(p.sss),
      philhealth: m(p.philhealth),
      pagibig: m(p.pagibig),
      withholdingTax: m(p.withholdingTax),
      totalDeductions: m(p.totalDeductions),
      netPay: m(p.netPay),
    };
  }
}
