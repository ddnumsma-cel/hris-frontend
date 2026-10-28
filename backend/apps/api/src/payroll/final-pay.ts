import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@msma/db';
import { FinalPayOpen, FinalPayOpenSchema, FinalPayRelease, FinalPayReleaseSchema, utcDateToDateKey } from '@msma/shared';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { ApiZodBody, ZodPipe } from '../common/zod';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const money = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOf = (key: string) => new Date(`${key}T00:00:00Z`);

type CaseRow = Prisma.FinalPayCaseGetPayload<{ include: { employee: { select: { employeeNo: true } } } }>;

/**
 * Final pay cases (Payroll › Final pay). Accounting works the figures out on the website from the approved runs,
 * loans and claims, opens a case and releases it with the check or transfer reference: releasing freezes the
 * figures, settles the loans and marks the reimbursements paid, but only if they are still what the figures used.
 */
@Injectable()
export class FinalPayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private view(c: CaseRow) {
    return {
      id: c.id,
      employeeId: c.employee.employeeNo,
      lastDay: utcDateToDateKey(c.lastDay),
      reason: c.reason,
      openedBy: c.openedBy,
      openedAt: c.openedAt.toISOString(),
      ...(c.releasedAt
        ? { released: { at: c.releasedAt.toISOString(), by: c.releasedBy ?? '', reference: c.reference ?? '', items: c.items as unknown[], total: Number(c.total) } }
        : {}),
    };
  }

  private include = { employee: { select: { employeeNo: true } } } as const;

  async list() {
    const rows = await this.prisma.finalPayCase.findMany({ include: this.include, orderBy: { openedAt: 'desc' } });
    return rows.map((c) => this.view(c));
  }

  private async employee(employeeNo: string) {
    const e = await this.prisma.employee.findUnique({ where: { employeeNo }, select: { id: true, firstName: true, lastName: true, hireDate: true } });
    if (!e) throw new NotFoundException('That employee no longer exists');
    return e;
  }

  async open(input: FinalPayOpen, user: AuthUser) {
    const e = await this.employee(input.employeeId);
    if (input.lastDay < utcDateToDateKey(e.hireDate)) throw new BadRequestException("The last day can't be before they were hired");
    if (await this.prisma.finalPayCase.findUnique({ where: { employeeId: e.id } })) throw new ConflictException(`${e.firstName} ${e.lastName} already has a final pay case`);
    const c = await this.prisma.$transaction(async (tx) => {
      const row = await tx.finalPayCase.create({ data: { employeeId: e.id, lastDay: dateOf(input.lastDay), reason: input.reason, openedBy: user.displayName, openedById: user.userId }, include: this.include });
      await this.audit.log({ actorId: user.userId, action: 'FINAL_PAY_OPENED', entity: 'Employee', entityId: e.id, after: { lastDay: input.lastDay, reason: input.reason } }, tx);
      return row;
    });
    return this.view(c);
  }

  async remove(id: string, user: AuthUser) {
    const c = await this.prisma.finalPayCase.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('That case no longer exists');
    if (c.releasedAt) throw new ConflictException('Released final pay stays on record');
    await this.prisma.$transaction(async (tx) => {
      await tx.finalPayCase.delete({ where: { id } });
      await this.audit.log({ actorId: user.userId, action: 'FINAL_PAY_REMOVED', entity: 'Employee', entityId: c.employeeId, before: { lastDay: utcDateToDateKey(c.lastDay), reason: c.reason } }, tx);
    });
  }

  async release(input: FinalPayRelease, user: AuthUser) {
    const e = await this.employee(input.employeeId);
    const sum = Math.round(input.items.reduce((n, i) => n + i.amount, 0) * 100) / 100;
    if (Math.abs(sum - input.total) > 0.005) throw new BadRequestException("The total doesn't match the items. Work the figures out again.");
    const released = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.finalPayCase.findUnique({ where: { employeeId: e.id } });
      if (existing?.releasedAt) throw new ConflictException('This final pay was already released');
      // The figures must still be based on what's on record: unpaid approved claims and open loans of this person.
      const claims = await tx.claim.findMany({ where: { id: { in: input.basis.claimIds } } });
      if (claims.length !== input.basis.claimIds.length || claims.some((c) => c.employeeId !== e.id || c.status !== 'approved' || c.paidAt))
        throw new ConflictException('The reimbursements changed since the figures were worked out. Open the case again.');
      const loanIds = input.basis.loans.map((l) => l.id);
      const loans = await tx.loan.findMany({ where: { id: { in: loanIds } } });
      if (loans.length !== loanIds.length || loans.some((l) => l.employeeId !== e.id || l.status === 'settled'))
        throw new ConflictException('The loans changed since the figures were worked out. Open the case again.');
      const now = new Date();
      const data = { releasedAt: now, releasedBy: user.displayName, reference: input.reference, items: input.items as unknown as Prisma.InputJsonValue, total: new Prisma.Decimal(input.total.toFixed(2)) };
      const row = existing
        ? await tx.finalPayCase.update({ where: { id: existing.id }, data, include: this.include })
        : await tx.finalPayCase.create({ data: { employeeId: e.id, lastDay: dateOf(input.lastDay), reason: input.reason, openedBy: user.displayName, openedById: user.userId, ...data }, include: this.include });
      if (loanIds.length) await tx.loan.updateMany({ where: { id: { in: loanIds } }, data: { status: 'settled', closedBy: user.displayName, closedAt: now, note: 'Closed in final pay' } });
      if (input.basis.claimIds.length)
        await tx.claim.updateMany({ where: { id: { in: input.basis.claimIds } }, data: { paidAt: now, paidBy: user.displayName, payoutMethod: 'final pay', payoutRef: 'Final pay' } });
      await this.audit.log({ actorId: user.userId, action: 'FINAL_PAY_RELEASED', entity: 'Employee', entityId: e.id, after: { total: input.total, reference: input.reference, loansSettled: loanIds.length, claimsPaid: input.basis.claimIds.length } }, tx);
      return row;
    });
    const name = `${e.firstName} ${e.lastName}`;
    await this.notifications.send({ topic: 'payslip', kind: 'approved', title: 'Your final pay was released', body: `${money(input.total)} · reference ${input.reference}.`, employeeIds: [e.id], actorId: user.userId });
    await this.notifications.send({ topic: 'separation', kind: 'update', title: `Final pay released for ${name}`, body: `${money(input.total)} by ${user.displayName} (${input.reference}).`, roles: ['HR_ADMIN'], actorId: user.userId });
    return this.view(released);
  }
}

@ApiTags('payroll')
@ApiBearerAuth()
@Roles('PAYROLL_ADMIN', 'SYSTEM_ADMIN')
@Controller('payroll/final-pay')
export class FinalPayController {
  constructor(private readonly finalPay: FinalPayService) {}

  @Get()
  @ApiOperation({ operationId: 'listFinalPay', summary: 'Final pay cases, open and released' })
  list() {
    return this.finalPay.list();
  }

  @Post()
  @ApiOperation({ operationId: 'openFinalPay', summary: 'Open a final pay case for someone leaving' })
  @ApiZodBody(FinalPayOpenSchema)
  open(@CurrentUser() user: AuthUser, @Body(new ZodPipe(FinalPayOpenSchema)) body: FinalPayOpen) {
    return this.finalPay.open(body, user);
  }

  @Post('release')
  @HttpCode(200)
  @ApiOperation({ operationId: 'releaseFinalPay', summary: 'Release final pay: freezes the figures, settles the loans, marks the reimbursements paid' })
  @ApiZodBody(FinalPayReleaseSchema)
  release(@CurrentUser() user: AuthUser, @Body(new ZodPipe(FinalPayReleaseSchema)) body: FinalPayRelease) {
    return this.finalPay.release(body, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'removeFinalPay', summary: 'Remove an unreleased final pay case' })
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.finalPay.remove(id, user);
  }
}
