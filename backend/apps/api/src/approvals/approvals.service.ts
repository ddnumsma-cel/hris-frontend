import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@msma/db';
import {
  addDays,
  ApprovalItem,
  ApprovalListQuery,
  ApprovalType,
  CreateLeaveRequest,
  CreateOvertimeRequest,
  CreateTimeAdjustment,
  CreateUndertimeRequest,
  DateKey,
  dateKeyToUtcDate,
  formatDate,
  formatDateRange,
  formatMinutes,
  formatTime,
  manilaToday,
  MyRequest,
  REQUEST_FILING_WINDOW_DAYS,
  shiftBounds,
  timeOnShift,
  WorkflowStep,
} from '@msma/shared';
import { AttendanceService } from '../attendance/attendance.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser, isHrLike, requireEmployeeId } from '../common/auth.decorators';
import { EmployeesService, fullName } from '../employees/employees.service';
import { LeaveService } from '../leave/leave.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from './workflows.service';

const include = {
  employee: { include: { site: true } },
  decidedBy: true,
} satisfies Prisma.ApprovalRequestInclude;
type ApprovalWithRefs = Prisma.ApprovalRequestGetPayload<{ include: typeof include }>;

const LEAVE_LABEL: Record<string, string> = {
  VL: 'Vacation',
  SL: 'Sick',
  SIL: 'Service incentive',
};

/** Approval inbox for leave, overtime, undertime and time adjustments. Decisions are applied to the underlying request and audited. */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employees: EmployeesService,
    private readonly leave: LeaveService,
    private readonly attendance: AttendanceService,
    private readonly audit: AuditService,
    private readonly workflows: WorkflowsService,
  ) {}

  private stepsOf(a: { steps: unknown }): WorkflowStep[] {
    return Array.isArray(a.steps) && a.steps.length ? (a.steps as WorkflowStep[]) : [{ approver: 'supervisor' }];
  }

  /** The item with its workflow: step names, the one it's at, who it's waiting for and whether this person may decide it. */
  private async withWorkflow(user: AuthUser, a: ApprovalWithRefs): Promise<ApprovalItem> {
    const steps = this.stepsOf(a);
    const pending = a.status === 'PENDING';
    return {
      ...this.toItem(a),
      steps: steps.map((s) => this.workflows.stepName(s)),
      step: a.step,
      ...(pending ? { waitingFor: this.workflows.stepName(steps[a.step] ?? steps[0]!) } : {}),
      canDecide: pending && a.employeeId !== user.employeeId && (await this.workflows.canDecide(user, a.employeeId, steps[a.step])),
    };
  }

  private toItem(a: ApprovalWithRefs): ApprovalItem {
    return {
      id: a.id,
      type: a.type,
      status: a.status,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
      decidedAt: a.decidedAt?.toISOString() ?? null,
      decidedBy: a.decidedBy?.displayName ?? null,
      reason: a.reason,
      employee: {
        id: a.employee.id,
        fullName: fullName(a.employee),
        employeeNo: a.employee.employeeNo,
        siteName: a.employee.site.name,
      },
    };
  }

  /** Employees whose requests the caller may see: HR/System = everyone (undefined), managers = their team. */
  async scopeIds(user: AuthUser): Promise<string[] | undefined> {
    if (isHrLike(user.role)) return undefined;
    if (user.role === 'MANAGER') {
      // Their team, and the people in any department they head (for department-head workflow steps).
      const me = requireEmployeeId(user);
      const headed = await this.prisma.siteDepartment.findMany({ where: { headEmployeeId: me }, select: { siteId: true, departmentId: true } });
      const inDepts = headed.length
        ? (await this.prisma.employee.findMany({ where: { active: true, OR: headed.map((h) => ({ siteId: h.siteId, departmentId: h.departmentId })) }, select: { id: true } })).map((e) => e.id)
        : [];
      return [...new Set([...(await this.employees.teamIds(me)), ...inDepts])];
    }
    throw new ForbiddenException('You do not have access to approvals');
  }

  async list(user: AuthUser, q: ApprovalListQuery) {
    const scope = await this.scopeIds(user);
    const where: Prisma.ApprovalRequestWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(scope ? { employeeId: { in: scope } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.approvalRequest.count({ where }),
      this.prisma.approvalRequest.findMany({
        where,
        include,
        orderBy: { createdAt: q.status === 'PENDING' ? 'asc' : 'desc' },
        take: q.limit,
      }),
    ]);
    return { total, items: await Promise.all(rows.map((r) => this.withWorkflow(user, r))) };
  }

  async countPending(scope?: string[], siteId?: string): Promise<number> {
    const siteIds = siteId ? [...(await this.employees.directory(siteId)).keys()] : undefined;
    const ids = scope && siteIds ? scope.filter((id) => siteIds.includes(id)) : (scope ?? siteIds);
    return this.prisma.approvalRequest.count({
      where: { status: 'PENDING', ...(ids ? { employeeId: { in: ids } } : {}) },
    });
  }

  async decide(
    user: AuthUser,
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string,
  ): Promise<ApprovalItem> {
    const approval = await this.prisma.approvalRequest.findUnique({ where: { id }, include });
    if (!approval) throw new NotFoundException('Request not found');
    if (approval.employeeId === user.employeeId)
      throw new ForbiddenException('You cannot decide on your own request');
    if (approval.status !== 'PENDING') {
      throw new ConflictException(
        `Already ${approval.status.toLowerCase()}${approval.decidedBy ? ` by ${approval.decidedBy.displayName}` : ''}`,
      );
    }
    // The approval workflow decides who may act on the step it's at; the Super Admin may act on any step.
    const steps = this.stepsOf(approval);
    if (!(await this.workflows.canDecide(user, approval.employeeId, steps[approval.step])))
      throw new ForbiddenException(`This request is waiting for: ${this.workflows.stepName(steps[approval.step] ?? steps[0]!)}`);
    // Approving a step that isn't the last moves it to the next step; it stays waiting.
    if (decision === 'APPROVED' && approval.step + 1 < steps.length) {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.approvalRequest.updateMany({
          where: { id, status: 'PENDING', step: approval.step },
          data: {
            step: approval.step + 1,
            stepLog: [...((approval.stepLog as object[]) ?? []), { step: this.workflows.stepName(steps[approval.step]!), by: user.displayName, at: new Date().toISOString(), reason: reason ?? null }],
          },
        });
        if (count === 0) throw new ConflictException('This request was just decided by someone else');
        await this.audit.log(
          { actorId: user.userId, action: 'APPROVAL_STEP_APPROVED', entity: 'ApprovalRequest', entityId: id, after: { type: approval.type, step: this.workflows.stepName(steps[approval.step]!), next: this.workflows.stepName(steps[approval.step + 1]!), employeeId: approval.employeeId } },
          tx,
        );
      });
      return this.withWorkflow(user, (await this.prisma.approvalRequest.findUnique({ where: { id }, include }))!);
    }

    const effect = await this.prisma.$transaction(async (tx) => {
      // Guard against a concurrent decision: only flip a row that is still PENDING.
      const { count } = await tx.approvalRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: decision,
          decidedById: user.userId,
          decidedAt: new Date(),
          reason: reason ?? null,
        },
      });
      if (count === 0) throw new ConflictException('This request was just decided by someone else');

      let affected: { employeeId: string; from: string; to: string } | null = null;
      if (approval.type === 'LEAVE' && approval.leaveRequestId) {
        affected = await this.leave.decide(tx, approval.leaveRequestId, decision);
      } else if (approval.type === 'OT' && approval.otRequestId) {
        const r = await this.attendance.decideOt(tx, approval.otRequestId, decision);
        affected = { employeeId: r.employeeId, from: r.date, to: r.date };
      } else if (approval.type === 'UNDERTIME' && approval.undertimeRequestId) {
        const r = await this.attendance.decideUndertime(tx, approval.undertimeRequestId, decision);
        affected = { employeeId: r.employeeId, from: r.date, to: r.date };
      } else if (approval.type === 'DTR_FIX' && approval.dtrCorrectionId) {
        const r = await this.attendance.decideCorrection(tx, approval.dtrCorrectionId, decision);
        affected = { employeeId: r.employeeId, from: r.date, to: r.date };
      }

      await this.audit.log(
        {
          actorId: user.userId,
          action: decision === 'APPROVED' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
          entity: 'ApprovalRequest',
          entityId: id,
          before: { status: approval.status },
          after: {
            status: decision,
            reason: reason ?? null,
            type: approval.type,
            detail: approval.detail,
            employeeId: approval.employeeId,
          },
        },
        tx,
      );
      return affected;
    });

    // Approved leave, undertime and time adjustments change the DTR: refresh the affected days (up to today).
    if (
      decision === 'APPROVED' &&
      effect &&
      approval.type !== 'OT' &&
      effect.from <= manilaToday()
    ) {
      await this.attendance.recompute(effect.from, effect.to, [effect.employeeId]);
    }
    return this.withWorkflow(user, (await this.prisma.approvalRequest.findUnique({ where: { id }, include }))!);
  }

  /** Employee self-service: file a leave request (creates the leave request and its approval item). */
  async submitLeave(user: AuthUser, body: CreateLeaveRequest): Promise<MyRequest> {
    const employeeId = requireEmployeeId(user);
    const approval = await this.prisma.$transaction(async (tx) => {
      const { request, typeName, days } = await this.leave.createRequest(tx, employeeId, body);
      const created = await tx.approvalRequest.create({
        data: {
          type: 'LEAVE',
          employeeId,
          detail: `${LEAVE_LABEL[body.leaveTypeCode] ?? typeName} · ${formatDateRange(body.startDate, body.endDate)} · ${days} day${days === 1 ? '' : 's'} · ${body.reason}`,
          leaveRequestId: request.id,
          // Long-leave steps count only past their days.
          steps: await this.workflows.stepsFor('LEAVE', days),
        },
      });
      await this.audit.log(
        {
          actorId: user.userId,
          action: 'LEAVE_SUBMITTED',
          entity: 'ApprovalRequest',
          entityId: created.id,
          after: { ...body, days },
        },
        tx,
      );
      return created;
    });
    return this.toMyRequest(approval);
  }

  // ---------- Overtime, undertime and time adjustments (employee self-service) ----------

  /** The date must fall inside the filing window; `future` allows filing ahead (overtime, undertime). */
  private checkDate(date: DateKey, what: string, future: boolean) {
    const today = manilaToday();
    if (date < addDays(today, -REQUEST_FILING_WINDOW_DAYS))
      throw new BadRequestException(
        `${what} can be filed up to ${REQUEST_FILING_WINDOW_DAYS} days back. For older dates, please ask HR.`,
      );
    if (!future && date > today)
      throw new BadRequestException(
        `A ${what.toLowerCase()} can only be filed for today or earlier.`,
      );
    if (future && date > addDays(today, REQUEST_FILING_WINDOW_DAYS))
      throw new BadRequestException(
        `${what} can be filed up to ${REQUEST_FILING_WINDOW_DAYS} days ahead.`,
      );
  }

  /** One pending request of a kind per day, so approvers never see duplicates. */
  private async checkNoPending(
    employeeId: string,
    type: ApprovalType,
    date: DateKey,
    what: string,
  ) {
    const where = { employeeId, date: dateKeyToUtcDate(date), status: 'PENDING' as const };
    const pending =
      type === 'OT'
        ? await this.prisma.otRequest.count({ where })
        : type === 'UNDERTIME'
          ? await this.prisma.undertimeRequest.count({ where })
          : await this.prisma.dtrCorrection.count({ where });
    if (pending)
      throw new ConflictException(
        `You already have a pending ${what.toLowerCase()} for ${formatDate(date)}. Wait for the decision, or ask your manager.`,
      );
  }

  /** Creates the approval item and its audit row for a request created in the same transaction. */
  private async fileApproval(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    data: Prisma.ApprovalRequestUncheckedCreateInput,
    action: string,
    after: Record<string, unknown>,
  ) {
    const created = await tx.approvalRequest.create({ data: { ...data, steps: await this.workflows.stepsFor(data.type) } });
    await this.audit.log(
      { actorId: user.userId, action, entity: 'ApprovalRequest', entityId: created.id, after },
      tx,
    );
    return created;
  }

  async submitOvertime(user: AuthUser, body: CreateOvertimeRequest): Promise<MyRequest> {
    const employeeId = requireEmployeeId(user);
    this.checkDate(body.date, 'Overtime', true);
    await this.checkNoPending(employeeId, 'OT', body.date, 'Overtime request');
    const approval = await this.prisma.$transaction(async (tx) => {
      const request = await tx.otRequest.create({
        data: {
          employeeId,
          date: dateKeyToUtcDate(body.date),
          minutes: body.minutes,
          reason: body.reason,
        },
      });
      return this.fileApproval(
        tx,
        user,
        {
          type: 'OT',
          employeeId,
          detail: `Overtime · ${formatDate(body.date)} · ${formatMinutes(body.minutes)} · ${body.reason}`,
          otRequestId: request.id,
        },
        'OT_SUBMITTED',
        body,
      );
    });
    return this.toMyRequest(approval);
  }

  async submitUndertime(user: AuthUser, body: CreateUndertimeRequest): Promise<MyRequest> {
    const employeeId = requireEmployeeId(user);
    this.checkDate(body.date, 'Undertime', true);
    const { shift } = await this.employees.forComputeOne(employeeId);
    const bounds = shiftBounds(body.date, shift);
    const leaveAt = timeOnShift(body.date, body.leaveTime, shift);
    if (leaveAt <= bounds.start || leaveAt >= bounds.end)
      throw new BadRequestException(
        `Pick a time during your shift (${shift.startTime} to ${shift.endTime}).`,
      );
    await this.checkNoPending(employeeId, 'UNDERTIME', body.date, 'Undertime request');
    const minutes = Math.round((bounds.end.getTime() - leaveAt.getTime()) / 60_000);
    const approval = await this.prisma.$transaction(async (tx) => {
      const request = await tx.undertimeRequest.create({
        data: {
          employeeId,
          date: dateKeyToUtcDate(body.date),
          leaveAt,
          minutes,
          reason: body.reason,
        },
      });
      return this.fileApproval(
        tx,
        user,
        {
          type: 'UNDERTIME',
          employeeId,
          detail: `Undertime · ${formatDate(body.date)} · leave at ${body.leaveTime} (${formatMinutes(minutes)} early) · ${body.reason}`,
          undertimeRequestId: request.id,
        },
        'UNDERTIME_SUBMITTED',
        { ...body, minutes },
      );
    });
    return this.toMyRequest(approval);
  }

  async submitTimeAdjustment(user: AuthUser, body: CreateTimeAdjustment): Promise<MyRequest> {
    const employeeId = requireEmployeeId(user);
    this.checkDate(body.date, 'Time adjustment', false);
    const { shift } = await this.employees.forComputeOne(employeeId);
    const timeIn = body.timeIn ? timeOnShift(body.date, body.timeIn, shift) : null;
    let timeOut = body.timeOut ? timeOnShift(body.date, body.timeOut, shift) : null;
    // Worked past midnight on a day shift: the time out is on the next day.
    if (timeIn && timeOut && timeOut <= timeIn) timeOut = new Date(timeOut.getTime() + 86_400_000);
    if ((timeOut && timeOut > new Date()) || (timeIn && timeIn > new Date()))
      throw new BadRequestException('The time cannot be later than now.');
    await this.checkNoPending(employeeId, 'DTR_FIX', body.date, 'Time adjustment');
    const parts = [
      timeIn ? `time in ${formatTime(timeIn)}` : null,
      timeOut ? `time out ${formatTime(timeOut)}` : null,
    ].filter(Boolean);
    const approval = await this.prisma.$transaction(async (tx) => {
      const request = await tx.dtrCorrection.create({
        data: {
          employeeId,
          date: dateKeyToUtcDate(body.date),
          requestedTimeIn: timeIn,
          requestedTimeOut: timeOut,
          reason: body.reason,
        },
      });
      return this.fileApproval(
        tx,
        user,
        {
          type: 'DTR_FIX',
          employeeId,
          detail: `Time adjustment · ${formatDate(body.date)} · ${parts.join(', ')} · ${body.reason}`,
          dtrCorrectionId: request.id,
        },
        'DTR_FIX_SUBMITTED',
        body,
      );
    });
    return this.toMyRequest(approval);
  }

  private toMyRequest(a: {
    id: string;
    type: MyRequest['type'];
    status: MyRequest['status'];
    detail: string;
    createdAt: Date;
    decidedAt: Date | null;
    reason: string | null;
  }): MyRequest {
    return {
      id: a.id,
      type: a.type,
      status: a.status,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
      decidedAt: a.decidedAt?.toISOString() ?? null,
      reason: a.reason,
    };
  }

  async myRequests(employeeId: string): Promise<MyRequest[]> {
    const rows = await this.prisma.approvalRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => this.toMyRequest(r));
  }
}
