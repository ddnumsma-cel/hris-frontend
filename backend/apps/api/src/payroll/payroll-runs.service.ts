import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import {
  ApprovePayRun,
  CreatePayRun,
  dateKeyToUtcDate,
  manilaToday,
  PayrollPerson,
  PayRun,
  PayRunLine,
  UpdatePayRun,
  utcDateToDateKey,
} from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type RunRow = Prisma.PayrollRunGetPayload<object>;

const EMPLOYMENT_TYPE: Record<string, string> = {
  PROBATIONARY: 'Probationary',
  REGULAR: 'Regular',
  CONTRACTUAL: 'Fixed-term',
  PROJECT: 'Fixed-term',
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const total = (lines: PayRunLine[], f: (l: PayRunLine) => number) => round2(lines.reduce((n, l) => n + f(l), 0)).toFixed(2);

/**
 * Payroll runs made on the website. It works the pay out (the workbook rules in its lib/pay/engine.ts) and sends the
 * lines; this keeps each run, refuses overlapping cut-offs and changes to approved runs, and on approval locks the run
 * and writes everyone's payslip. Lines name employees by employee number.
 */
@Injectable()
export class PayrollRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private view(r: RunRow): PayRun {
    const iso = (d: Date | null) => d?.toISOString() ?? undefined;
    return {
      id: r.id,
      label: r.label,
      from: utcDateToDateKey(r.cutoffFrom),
      to: utcDateToDateKey(r.cutoffTo),
      status: r.status === 'APPROVED' || r.status === 'RELEASED' || r.status === 'LOCKED' ? 'approved' : 'draft',
      lines: r.lines as PayRun['lines'],
      adjustments: r.adjustments as PayRun['adjustments'],
      auto: r.auto as PayRun['auto'],
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
      computedAt: r.computedAt.toISOString(),
      reviewedBy: r.reviewedBy ?? undefined,
      reviewedAt: iso(r.reviewedAt),
      approvedBy: r.approvedBy ?? undefined,
      approvedAt: iso(r.approvedAt),
    };
  }

  /** Every line must be a current employee record, once. */
  private async checkLines(lines: PayRunLine[]): Promise<Map<string, string>> {
    const nos = lines.map((l) => l.person.id);
    if (new Set(nos).size !== nos.length) throw new BadRequestException('Someone is on this run twice');
    const rows = await this.prisma.employee.findMany({ where: { employeeNo: { in: nos } }, select: { id: true, employeeNo: true } });
    const ids = new Map(rows.map((r) => [r.employeeNo, r.id]));
    const unknown = nos.filter((n) => !ids.has(n));
    if (unknown.length) throw new BadRequestException(`Not employee records: ${unknown.slice(0, 5).join(', ')}. Reload the page and try again.`);
    return ids;
  }

  private totals(lines: PayRunLine[]) {
    return {
      totalGross: total(lines, (l) => l.gross),
      totalDeductions: total(lines, (l) => l.gross - l.net),
      totalNet: total(lines, (l) => l.net),
    };
  }

  private async draft(id: string): Promise<RunRow> {
    const r = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!r || !r.label) throw new NotFoundException('That payroll run no longer exists');
    if (this.view(r).status !== 'draft') throw new ConflictException('This run is approved and locked. Add the correction to the next run.');
    return r;
  }

  /** Runs made on the website, newest first. Employees get only approved runs, each with just their own line. */
  async list(user: AuthUser): Promise<PayRun[]> {
    const own = user.role !== 'PAYROLL_ADMIN' && user.role !== 'SYSTEM_ADMIN';
    const rows = await this.prisma.payrollRun.findMany({
      where: { label: { not: '' }, ...(own ? { status: { in: ['APPROVED', 'RELEASED', 'LOCKED'] } } : {}) },
      orderBy: { cutoffFrom: 'desc' },
    });
    if (!own) return rows.map((r) => this.view(r));
    const me = user.employeeId
      ? (await this.prisma.employee.findUnique({ where: { id: user.employeeId }, select: { employeeNo: true } }))?.employeeNo
      : undefined;
    return rows
      .map((r) => this.view(r))
      .map((r) => ({
        ...r,
        lines: r.lines.filter((l) => (l as { person?: { id?: string } }).person?.id === me),
        adjustments: me && r.adjustments[me] ? { [me]: r.adjustments[me] } : {},
        auto: me && r.auto[me] ? { [me]: r.auto[me] } : {},
      }))
      .filter((r) => r.lines.length);
  }

  async get(id: string): Promise<PayRun> {
    const r = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!r || !r.label) throw new NotFoundException('That payroll run no longer exists');
    return this.view(r);
  }

  async create(input: CreatePayRun, user: AuthUser): Promise<PayRun> {
    if (input.from > input.to) throw new BadRequestException('The cut-off ends before it starts');
    await this.checkLines(input.lines);
    const from = dateKeyToUtcDate(input.from);
    const to = dateKeyToUtcDate(input.to);
    // No day is paid twice: refuse a cut-off that shares days with another run.
    const clash = await this.prisma.payrollRun.findFirst({ where: { cutoffFrom: { lte: to }, cutoffTo: { gte: from } } });
    if (clash)
      throw new ConflictException(
        clash.cutoffFrom.getTime() === from.getTime() && clash.cutoffTo.getTime() === to.getTime()
          ? "There's already a payroll run for this cutoff"
          : `These dates overlap the ${clash.label || `${utcDateToDateKey(clash.cutoffFrom)} to ${utcDateToDateKey(clash.cutoffTo)}`} run, so some days would be paid twice`,
      );
    const r = await this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          label: input.label,
          cutoffFrom: from,
          cutoffTo: to,
          payDate: to,
          status: 'DRAFT',
          lines: input.lines as Prisma.InputJsonValue,
          adjustments: input.adjustments as Prisma.InputJsonValue,
          auto: input.auto as Prisma.InputJsonValue,
          createdBy: user.displayName,
          ...this.totals(input.lines),
        },
      });
      await this.audit.log(
        { actorId: user.userId, action: 'PAYROLL_RUN_CREATED', entity: 'PayrollRun', entityId: run.id, after: { label: input.label, employees: input.lines.length } },
        tx,
      );
      return run;
    });
    return this.view(r);
  }

  /** Save a draft worked out again. Adjustments added or removed are written to the audit trail. */
  async update(id: string, input: UpdatePayRun, user: AuthUser): Promise<PayRun> {
    const r = await this.draft(id);
    await this.checkLines(input.lines);
    const before = r.adjustments as PayRun['adjustments'];
    const flat = (m: PayRun['adjustments']) => Object.entries(m).flatMap(([emp, list]) => list.map((a) => ({ emp, ...a })));
    const oldIds = new Set(flat(before).map((a) => a.id));
    const newIds = new Set(flat(input.adjustments).map((a) => a.id));
    const added = flat(input.adjustments).filter((a) => !oldIds.has(a.id));
    const removed = flat(before).filter((a) => !newIds.has(a.id));
    const next = await this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.update({
        where: { id },
        data: {
          lines: input.lines as Prisma.InputJsonValue,
          adjustments: input.adjustments as Prisma.InputJsonValue,
          auto: input.auto as Prisma.InputJsonValue,
          computedAt: new Date(),
          ...this.totals(input.lines),
        },
      });
      for (const a of added)
        await this.audit.log(
          { actorId: user.userId, action: 'PAYROLL_ADJUSTMENT_ADDED', entity: 'PayrollRun', entityId: id, after: { employeeNo: a.emp, label: a.label, amount: a.amount, taxable: a.taxable, reason: a.reason } },
          tx,
        );
      for (const a of removed)
        await this.audit.log(
          { actorId: user.userId, action: 'PAYROLL_ADJUSTMENT_REMOVED', entity: 'PayrollRun', entityId: id, before: { employeeNo: a.emp, label: a.label, amount: a.amount } },
          tx,
        );
      return run;
    });
    return this.view(next);
  }

  /** "Reviewed by" on the workbook's Summary sheet. */
  async review(id: string, user: AuthUser): Promise<PayRun> {
    const r = await this.draft(id);
    if (r.reviewedBy) throw new ConflictException(`Already reviewed by ${r.reviewedBy}`);
    const next = await this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.update({ where: { id }, data: { reviewedBy: user.displayName, reviewedAt: new Date() } });
      await this.audit.log({ actorId: user.userId, action: 'PAYROLL_RUN_REVIEWED', entity: 'PayrollRun', entityId: id, after: { label: r.label } }, tx);
      return run;
    });
    return this.view(next);
  }

  /** Lock the run with the numbers as they are now and release everyone's payslip. */
  async approve(id: string, input: ApprovePayRun, user: AuthUser): Promise<PayRun> {
    const r = await this.draft(id);
    const ids = await this.checkLines(input.lines);
    const now = new Date();
    const m = (n: number) => round2(n).toFixed(2);
    const next = await this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.update({
        where: { id },
        data: {
          status: 'RELEASED',
          lines: input.lines as Prisma.InputJsonValue,
          auto: input.auto as Prisma.InputJsonValue,
          computedAt: now,
          approvedBy: user.displayName,
          approvedAt: now,
          ...this.totals(input.lines),
        },
      });
      await tx.payslip.deleteMany({ where: { payrollRunId: id } });
      await tx.payslip.createMany({
        data: input.lines.map((l) => {
          const pay = l.pay as { nightPay?: number; premiumPay?: number };
          return {
            payrollRunId: id,
            employeeId: ids.get(l.person.id)!,
            daysPaid: l.time.present.toFixed(1),
            basicPay: m(l.basic),
            overtimePay: m(l.overtime),
            nightDiffPay: m(pay.nightPay ?? 0),
            holidayPay: m(pay.premiumPay ?? 0),
            lateUndertimeDeduction: m(l.deductions),
            grossPay: m(l.gross),
            sss: m(l.sssEe),
            philhealth: m(l.phEe),
            pagibig: m(l.piEe),
            withholdingTax: m(l.tax),
            totalDeductions: m(l.gross - l.net),
            netPay: m(l.net),
          };
        }),
      });
      await this.audit.log(
        {
          actorId: user.userId,
          action: 'PAYROLL_RUN_APPROVED',
          entity: 'PayrollRun',
          entityId: id,
          after: { label: r.label, employees: input.lines.length, takeHome: this.totals(input.lines).totalNet },
        },
        tx,
      );
      return run;
    });
    return this.view(next);
  }

  /** Only drafts can be deleted; approved runs stay on record. */
  async remove(id: string, user: AuthUser): Promise<void> {
    const r = await this.prisma.payrollRun.findUnique({ where: { id } });
    if (!r || !r.label) throw new NotFoundException('That payroll run no longer exists');
    if (this.view(r).status !== 'draft') throw new ConflictException('Approved runs stay on record');
    await this.prisma.$transaction(async (tx) => {
      await tx.payrollRun.delete({ where: { id } });
      await this.audit.log({ actorId: user.userId, action: 'PAYROLL_RUN_DELETED', entity: 'PayrollRun', entityId: id, before: { label: r.label } }, tx);
    });
  }

  /** Everyone the website's pay engine works pay out for, with the numbers its exports print. */
  async people(): Promise<PayrollPerson[]> {
    const today = manilaToday();
    const rows = await this.prisma.employee.findMany({
      where: { active: true },
      include: { site: true, department: true, position: true, govId: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return rows.map((e) => {
      const separated = e.separationDate ? utcDateToDateKey(e.separationDate) : undefined;
      const monthly = e.monthlySalary ? Number(e.monthlySalary.toString()) : Math.round((Number(e.dailyRate.toString()) * 261) / 12);
      return {
        id: e.employeeNo,
        name: `${e.firstName} ${e.lastName}`,
        position: e.position?.title ?? '',
        department: e.department?.name ?? 'No department',
        branch: e.site.name,
        type: EMPLOYMENT_TYPE[e.status] ?? 'Regular',
        status: separated && separated < today ? 'Separated' : 'Active',
        hired: utcDateToDateKey(e.hireDate),
        ...(separated ? { separated } : {}),
        salary: monthly,
        sex: e.sex === 'MALE' ? 'Male' : e.sex === 'FEMALE' ? 'Female' : '',
        sssNo: e.govId?.sss ?? '',
        philhealthNo: e.govId?.philhealth ?? '',
        pagibigNo: e.govId?.pagibig ?? '',
        tin: e.govId?.tin ?? '',
        ...(e.bankName ? { bank: { bank: e.bankName, accountName: e.bankAccountName ?? '', accountNumber: e.bankAccountNo ?? '' } } : {}),
      };
    });
  }
}
