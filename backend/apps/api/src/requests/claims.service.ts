import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import { addDays, ClaimInput, ClaimPay, dateKeyToUtcDate, manilaToday, utcDateToDateKey } from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/** As the website's rules (lib/reimbursements/rules.ts). */
const CLAIM_WINDOW_DAYS = 60;
const MAX_AMOUNT = 50_000;

type Row = Prisma.ClaimGetPayload<{ include: { employee: { select: { employeeNo: true; firstName: true; lastName: true; managerId: true } } } }>;
const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const what = (c: { category: string; otherType: string | null }) => (c.category === 'Other' ? (c.otherType ?? 'Other') : c.category);

/**
 * Reimbursements: the employee files a claim with the receipt; their approver (the manager with an Approver login,
 * else the Super Admin) endorses it; Accounting (or the Super Admin) gives the final approval and releases the money
 * straight to the employee. Never paid through payroll. Each step records who, when and why, and tells the people next.
 */
@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private include = { employee: { select: { employeeNo: true, firstName: true, lastName: true, managerId: true } } } as const;

  private view(c: Row) {
    const iso = (d: Date | null) => d?.toISOString();
    return {
      id: c.id,
      employeeId: c.employee.employeeNo,
      category: c.category,
      ...(c.otherType ? { otherType: c.otherType } : {}),
      merchant: c.merchant,
      purchaseDate: utcDateToDateKey(c.purchaseDate),
      amount: Number(c.amount.toString()),
      description: c.description,
      receipt: c.receipt,
      status: c.status,
      filedAt: c.filedAt.toISOString(),
      ...(c.approverDecidedBy ? { approverDecidedBy: c.approverDecidedBy, approverDecidedAt: iso(c.approverDecidedAt), approverNote: c.approverNote ?? undefined } : {}),
      ...(c.decidedBy ? { decidedBy: c.decidedBy, decidedAt: iso(c.decidedAt), note: c.note ?? undefined } : {}),
      ...(c.paidAt ? { paidAt: iso(c.paidAt), paidBy: c.paidBy ?? undefined, payoutMethod: c.payoutMethod ?? undefined, payoutRef: c.payoutRef ?? undefined } : {}),
    };
  }

  /** Is this person the one who endorses claims from that employee? Their manager with an Approver login. */
  private async isTheirApprover(user: AuthUser, managerId: string | null) {
    if (!managerId || user.role !== 'MANAGER' || user.employeeId !== managerId) return false;
    return true;
  }

  /** Who endorses an employee's claims: their manager with an active Approver login, else the Super Admins. */
  private async approverOf(managerId: string | null) {
    const ok = managerId && (await this.prisma.user.count({ where: { employeeId: managerId, role: 'MANAGER', status: 'active' } }));
    return ok ? { employeeIds: [managerId!] } : { roles: ['SYSTEM_ADMIN' as const] };
  }

  /** Everyone sees their own; an Approver also their team's; Accounting and the Super Admin everyone's. */
  async list(user: AuthUser) {
    const all = user.role === 'PAYROLL_ADMIN' || user.role === 'SYSTEM_ADMIN';
    const team = user.role === 'MANAGER' && user.employeeId ? { employee: { managerId: user.employeeId } } : null;
    const rows = await this.prisma.claim.findMany({
      where: all ? {} : { OR: [{ employeeId: user.employeeId ?? '-' }, ...(team ? [team] : [])] },
      include: this.include,
      orderBy: { filedAt: 'desc' },
    });
    return rows.map((c) => this.view(c));
  }

  async file(input: ClaimInput, user: AuthUser) {
    if (!user.employeeId) throw new ForbiddenException('Only employees file claims');
    const me = await this.prisma.employee.findUnique({ where: { id: user.employeeId }, select: { employeeNo: true, managerId: true, firstName: true, lastName: true } });
    if (!me || input.employeeId !== me.employeeNo) throw new ForbiddenException('You can only file your own claims');
    const today = manilaToday();
    if (input.category === 'Other' && !input.otherType) throw new BadRequestException('Type what kind of expense it is');
    if (input.purchaseDate > today) throw new BadRequestException("The receipt date can't be in the future");
    if (input.purchaseDate < addDays(today, -CLAIM_WINDOW_DAYS)) throw new BadRequestException(`Receipts older than ${CLAIM_WINDOW_DAYS} days can't be claimed`);
    if (input.amount > MAX_AMOUNT) throw new BadRequestException(`Claims over ₱${MAX_AMOUNT.toLocaleString('en-PH')} go through Finance, not here`);
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(input.receipt)) throw new BadRequestException('Add a photo of the receipt (JPG or PNG)');
    const amount = Math.round(input.amount * 100) / 100;
    const dup = await this.prisma.claim.findFirst({
      where: { employeeId: user.employeeId, status: { not: 'rejected' }, purchaseDate: dateKeyToUtcDate(input.purchaseDate), amount: amount.toFixed(2), merchant: { equals: input.merchant, mode: 'insensitive' } },
    });
    if (dup) throw new ConflictException("You've already claimed this receipt");
    const row = await this.prisma.$transaction(async (tx) => {
      const c = await tx.claim.create({
        data: {
          employeeId: user.employeeId!,
          category: input.category,
          otherType: input.category === 'Other' ? input.otherType : null,
          merchant: input.merchant,
          purchaseDate: dateKeyToUtcDate(input.purchaseDate),
          amount: amount.toFixed(2),
          description: input.description,
          receipt: input.receipt,
        },
        include: this.include,
      });
      await this.audit.log({ actorId: user.userId, action: 'CLAIM_FILED', entity: 'Claim', entityId: c.id, after: { category: what(c), merchant: c.merchant, amount } }, tx);
      return c;
    });
    await this.notifications.send({ topic: 'claim', kind: 'request', title: `${me.firstName} ${me.lastName} filed a ${what(row)} claim`, body: `${peso(amount)} at ${row.merchant}. Review it under Approvals.`, ...(await this.approverOf(me.managerId)), actorId: user.userId });
    return this.view(row);
  }

  /**
   * One step. A waiting claim: the approver (or the Super Admin) endorses it on to Accounting, or declines it.
   * An endorsed claim: Accounting (or the Super Admin) gives the final approval, or declines it.
   */
  async decide(id: string, approve: boolean, note: string, user: AuthUser) {
    const c = await this.prisma.claim.findUnique({ where: { id }, include: this.include });
    if (!c) throw new NotFoundException('That claim no longer exists');
    if (c.status !== 'pending' && c.status !== 'endorsed') throw new ConflictException('This claim was already decided');
    if (c.employeeId === user.employeeId) throw new ForbiddenException("You can't decide your own claim");
    const step = c.status === 'pending' ? 'approve' : 'final';
    const allowed = user.role === 'SYSTEM_ADMIN' || (step === 'approve' ? await this.isTheirApprover(user, c.employee.managerId) : user.role === 'PAYROLL_ADMIN');
    if (!allowed) throw new ForbiddenException(step === 'approve' ? "This claim is waiting for the employee's approver" : 'This claim is waiting for Accounting');
    if (!approve && !note) throw new BadRequestException('Say why, so the employee knows');
    const at = new Date();
    const data: Prisma.ClaimUpdateInput =
      step === 'approve'
        ? { status: approve ? 'endorsed' : 'rejected', approverDecidedBy: user.displayName, approverDecidedAt: at, approverNote: note || null, ...(approve ? {} : { decidedBy: user.displayName, decidedAt: at, note: note || null }) }
        : { status: approve ? 'approved' : 'rejected', decidedBy: user.displayName, decidedAt: at, note: note || null };
    const row = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.claim.updateMany({ where: { id, status: c.status }, data: data as Prisma.ClaimUpdateManyMutationInput });
      if (!count) throw new ConflictException('This claim was just decided by someone else');
      await this.audit.log({ actorId: user.userId, action: `CLAIM_${step === 'approve' ? (approve ? 'ENDORSED' : 'REJECTED') : approve ? 'APPROVED' : 'REJECTED'}`, entity: 'Claim', entityId: id, before: { status: c.status }, after: { note: note || null } }, tx);
      return tx.claim.findUniqueOrThrow({ where: { id }, include: this.include });
    });
    const label = `${what(row)} claim (${peso(Number(row.amount.toString()))})`;
    const name = `${row.employee.firstName} ${row.employee.lastName}`;
    if (row.status === 'endorsed') {
      await this.notifications.send({ topic: 'claim', kind: 'update', title: `Your ${label} was endorsed`, body: `${user.displayName} endorsed it. Accounting gives the final approval next.`, employeeIds: [row.employeeId], actorId: user.userId });
      await this.notifications.send({ topic: 'claim', kind: 'request', title: `${name}'s ${label} is ready for final approval`, body: `Endorsed by ${user.displayName}. ${row.merchant}.`, roles: ['PAYROLL_ADMIN'], actorId: user.userId });
    } else if (row.status === 'approved') {
      await this.notifications.send({ topic: 'claim', kind: 'approved', title: `Your ${label} was approved`, body: `${user.displayName} approved it. Accounting will release the money to you and you'll be told when it's sent.`, employeeIds: [row.employeeId], actorId: user.userId });
    } else {
      await this.notifications.send({ topic: 'claim', kind: 'rejected', title: `Your ${label} was rejected`, body: `Rejected by ${user.displayName}.${note ? ` "${note}"` : ''}`, employeeIds: [row.employeeId], actorId: user.userId });
    }
    return this.view(row);
  }

  /** Accounting releases approved claims straight to the employees (cash, bank transfer, e-wallet or check). */
  async pay(input: ClaimPay, user: AuthUser) {
    if (input.method !== 'cash' && !input.reference) throw new BadRequestException(input.method === 'check' ? 'Enter the check number' : 'Enter the transfer reference');
    const picked = await this.prisma.claim.findMany({ where: { id: { in: input.ids } }, include: this.include });
    if (picked.length !== input.ids.length) throw new NotFoundException('Some of those claims no longer exist');
    if (picked.some((c) => c.status !== 'approved' || c.paidAt)) throw new ConflictException("Only approved claims that aren't paid yet can be paid out");
    const ref = input.reference || (input.method === 'cash' ? 'Cash' : '');
    const paidAt = new Date(`${input.paidOn}T04:00:00Z`);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.claim.updateMany({ where: { id: { in: input.ids }, status: 'approved', paidAt: null }, data: { paidAt, paidBy: user.displayName, payoutMethod: input.method, payoutRef: ref } });
      if (count !== input.ids.length) throw new ConflictException('Some of those claims were just paid by someone else');
      await this.audit.log({ actorId: user.userId, action: 'CLAIMS_RELEASED', entity: 'Claim', entityId: input.ids.join(',').slice(0, 190), after: { claims: input.ids.length, method: input.method, reference: ref, paidOn: input.paidOn } }, tx);
    });
    const how = input.method === 'cash' ? 'in cash' : input.method === 'check' ? `by check (no. ${ref})` : `by ${input.method === 'transfer' ? 'bank transfer' : 'e-wallet'} (ref. ${ref})`;
    for (const c of picked)
      await this.notifications.send({ topic: 'claim', kind: 'approved', title: `Your ${what(c)} reimbursement was released`, body: `${peso(Number(c.amount.toString()))} released to you ${how}.`, employeeIds: [c.employeeId], actorId: user.userId });
    return { paid: picked.length };
  }
}
