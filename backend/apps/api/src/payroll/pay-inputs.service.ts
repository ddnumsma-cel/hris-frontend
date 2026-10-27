import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import {
  dateKeyToUtcDate,
  Loan,
  LoanInput,
  Paydays,
  PayProfile,
  PaySettings,
  utcDateToDateKey,
} from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';
import { notSelf } from '../common/not-self';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const PAYDAYS_KEY = 'paydays';
const DEFAULT_PAYDAYS: Paydays = { cutoffDays: [10, 25] };
const n = (v: Prisma.Decimal) => Number(v.toString());
const round2 = (v: number) => Math.round(v * 100) / 100;

type LoanRow = Prisma.LoanGetPayload<{ include: { employee: { select: { employeeNo: true } } } }>;

/**
 * Payroll inputs set on the website and read by its pay engine: the paydays that close each cut-off, each
 * employee's pay settings (allowances, tax-free pay, work week) and loans deducted until paid.
 * Employees are named by employee number, as in the website.
 */
@Injectable()
export class PayInputsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async employeeIdOf(employeeNo: string): Promise<{ id: string; name: string }> {
    const e = await this.prisma.employee.findUnique({ where: { employeeNo }, select: { id: true, firstName: true, lastName: true } });
    if (!e) throw new NotFoundException('That employee no longer exists');
    return { id: e.id, name: `${e.firstName} ${e.lastName}` };
  }

  // ---------- Paydays and pay settings ----------

  async paydays(): Promise<Paydays> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: PAYDAYS_KEY } });
    return (row?.value as Paydays | undefined) ?? DEFAULT_PAYDAYS;
  }

  /** Everyone sees the paydays (cut-offs); only payroll sees each person's pay settings. */
  async settings(withProfiles: boolean): Promise<PaySettings> {
    const days = await this.paydays();
    if (!withProfiles) return { ...days, profiles: {} };
    const rows = await this.prisma.payProfile.findMany({ include: { employee: { select: { employeeNo: true } } } });
    const profiles: Record<string, PayProfile> = {};
    for (const r of rows)
      profiles[r.employee.employeeNo] = {
        workWeek: r.workWeek === '6-day' ? '6-day' : '5-day',
        transportAllowance: n(r.transportAllowance),
        otMealRate: n(r.otMealRate),
        deMinimis: n(r.deMinimis),
        otherNonTaxable: n(r.otherNonTaxable),
        clientShare: n(r.clientShare),
        client: r.client,
        skipSss: r.skipSss,
        skipPhilhealth: r.skipPhilhealth,
        skipPagibig: r.skipPagibig,
      };
    return { ...days, profiles };
  }

  async savePaydays(input: Paydays, user: AuthUser): Promise<Paydays> {
    const [a, b] = input.cutoffDays;
    if (a === b) throw new BadRequestException('Pick two different paydays');
    if (Math.abs(a - b) < 7) throw new BadRequestException('Paydays should be at least a week apart');
    const next: Paydays = { cutoffDays: [Math.min(a, b), Math.max(a, b)] };
    const before = await this.paydays();
    await this.prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({ where: { key: PAYDAYS_KEY }, create: { key: PAYDAYS_KEY, value: next }, update: { value: next } });
      await this.audit.log({ actorId: user.userId, action: 'PAYDAYS_CHANGED', entity: 'AppSetting', entityId: PAYDAYS_KEY, before, after: next }, tx);
    });
    return next;
  }

  async saveProfile(employeeNo: string, input: PayProfile, user: AuthUser): Promise<PayProfile> {
    const e = await this.employeeIdOf(employeeNo);
    notSelf(user, e.id, 'change pay settings');
    const next: PayProfile = {
      ...input,
      transportAllowance: round2(input.transportAllowance),
      otMealRate: round2(input.otMealRate),
      deMinimis: round2(input.deMinimis),
      otherNonTaxable: round2(input.otherNonTaxable),
      clientShare: round2(input.clientShare),
      client: input.clientShare ? input.client : '',
    };
    const data = { ...next, transportAllowance: next.transportAllowance.toFixed(2), otMealRate: next.otMealRate.toFixed(2), deMinimis: next.deMinimis.toFixed(2), otherNonTaxable: next.otherNonTaxable.toFixed(2), clientShare: next.clientShare.toFixed(2) };
    await this.prisma.$transaction(async (tx) => {
      await tx.payProfile.upsert({ where: { employeeId: e.id }, create: { employeeId: e.id, ...data }, update: data });
      await this.audit.log({ actorId: user.userId, action: 'PAY_SETTINGS_CHANGED', entity: 'Employee', entityId: e.id, after: { employeeNo, ...next } }, tx);
    });
    return next;
  }

  // ---------- Loans ----------

  /** What approved payroll runs have taken for each loan (their "loan-<id>" items). */
  private async paidByLoan(): Promise<Map<string, number>> {
    const runs = await this.prisma.payrollRun.findMany({
      where: { status: { in: ['APPROVED', 'RELEASED', 'LOCKED'] }, label: { not: '' } },
      select: { auto: true },
    });
    const paid = new Map<string, number>();
    for (const r of runs)
      for (const items of Object.values((r.auto ?? {}) as Record<string, { id?: string; amount?: number }[]>))
        for (const a of items ?? [])
          if (a.id?.startsWith('loan-')) paid.set(a.id.slice(5), round2((paid.get(a.id.slice(5)) ?? 0) + Math.abs(a.amount ?? 0)));
    return paid;
  }

  private view(l: LoanRow, paid: Map<string, number>): Loan {
    return {
      id: l.id,
      employeeId: l.employee.employeeNo,
      kind: l.kind,
      reference: l.reference,
      principal: n(l.principal),
      installment: n(l.installment),
      startDate: utcDateToDateKey(l.startDate),
      status: l.status === 'stopped' || l.status === 'settled' ? l.status : 'active',
      note: l.note ?? undefined,
      createdBy: l.createdBy,
      createdAt: l.createdAt.toISOString(),
      closedBy: l.closedBy ?? undefined,
      closedAt: l.closedAt?.toISOString(),
      paid: paid.get(l.id) ?? 0,
    };
  }

  /** Payroll sees every loan; anyone else only their own. */
  async loans(user: AuthUser, all: boolean): Promise<Loan[]> {
    const rows = await this.prisma.loan.findMany({
      where: all ? {} : { employeeId: user.employeeId ?? '-' },
      include: { employee: { select: { employeeNo: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const paid = await this.paidByLoan();
    return rows.map((l) => this.view(l, paid));
  }

  async saveLoan(id: string | undefined, input: LoanInput, user: AuthUser): Promise<Loan> {
    const e = await this.employeeIdOf(input.employeeId);
    notSelf(user, e.id, 'add or change a loan deduction');
    const paid = await this.paidByLoan();
    const data = {
      employeeId: e.id,
      kind: input.kind,
      reference: input.reference,
      principal: round2(input.principal).toFixed(2),
      installment: round2(input.installment).toFixed(2),
      startDate: dateKeyToUtcDate(input.startDate),
      note: input.note || null,
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      let row: LoanRow;
      if (id) {
        const old = await tx.loan.findUnique({ where: { id } });
        if (!old) throw new NotFoundException('That loan no longer exists');
        if (old.status !== 'active') throw new ConflictException('This loan is closed');
        // A loan stays with the person who owes it; a different person's loan is added as a new one.
        if (old.employeeId !== e.id) throw new BadRequestException("A loan can't be moved to another employee. Stop it and add a new one.");
        const already = paid.get(id) ?? 0;
        if (input.principal < already) throw new BadRequestException(`₱${already.toLocaleString('en-PH')} is already paid, so the total can't be less than that`);
        row = await tx.loan.update({ where: { id }, data, include: { employee: { select: { employeeNo: true } } } });
      } else {
        const sep = await tx.employee.findUnique({ where: { id: e.id }, select: { active: true, separationDate: true } });
        if (!sep?.active) throw new BadRequestException('Choose a current employee');
        row = await tx.loan.create({ data: { ...data, createdBy: user.displayName }, include: { employee: { select: { employeeNo: true } } } });
      }
      await this.audit.log(
        {
          actorId: user.userId,
          action: id ? 'LOAN_CHANGED' : 'LOAN_ADDED',
          entity: 'Loan',
          entityId: row.id,
          after: { employeeNo: input.employeeId, kind: input.kind, reference: input.reference, principal: input.principal, installment: input.installment, startDate: input.startDate },
        },
        tx,
      );
      return row;
    });
    await this.notifications.send({ topic: 'loan', kind: 'update', title: id ? `Your ${input.kind} deduction changed` : `New ${input.kind} deduction`, body: `₱${input.installment.toLocaleString('en-PH')} per cutoff from ${input.startDate}, ₱${input.principal.toLocaleString('en-PH')} in all (${input.reference}).`, employeeIds: [e.id], actorId: user.userId });
    return this.view(saved, paid);
  }

  /** No more deductions, e.g. when the balance was paid outside payroll. */
  async stopLoan(id: string, reason: string, user: AuthUser): Promise<Loan> {
    const old = await this.prisma.loan.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('That loan no longer exists');
    if (old.status !== 'active') throw new ConflictException('This loan is already closed');
    notSelf(user, old.employeeId, 'stop a loan deduction');
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.loan.update({
        where: { id },
        data: { status: 'stopped', closedBy: user.displayName, closedAt: new Date(), note: reason },
        include: { employee: { select: { employeeNo: true } } },
      });
      await this.audit.log({ actorId: user.userId, action: 'LOAN_STOPPED', entity: 'Loan', entityId: id, after: { reason } }, tx);
      return r;
    });
    return this.view(row, await this.paidByLoan());
  }
}
