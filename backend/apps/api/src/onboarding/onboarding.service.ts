import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import { ApplicationInput, RequisitionInput, TrainingInput, TrainingView, utcDateToDateKey } from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type ReqRow = Prisma.JobRequisitionGetPayload<{ include: { applicants: { select: { appliedAt: true } } } }>;
type ApplicantRow = Prisma.ApplicantGetPayload<object>;
type TrainingRow = Prisma.TrainingRecordGetPayload<{ include: { employee: { select: { firstName: true; lastName: true } } } }>;

const WEEK_MS = 7 * 86_400_000;
/** At most this many applications an hour from the public job link, all together. */
const APPLICATIONS_PER_HOUR = 200;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-15" → "Nov 15, 2026", as the website shows due dates. */
const showDate = (d: Date) => {
  const k = utcDateToDateKey(d);
  return `${MONTHS[Number(k.slice(5, 7)) - 1]} ${Number(k.slice(8, 10))}, ${k.slice(0, 4)}`;
};
/** A typed date ("Nov 15, 2026" or "2026-11-15") as a calendar date, or null. */
function parseDate(text: string): Date | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : null;
  const t = iso ? Date.parse(iso) : Date.parse(`${text} 00:00:00 UTC`);
  return Number.isNaN(t) ? null : new Date(t);
}
const initials = (first: string, last: string) => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

/**
 * Onboarding on the website: job requisitions and their applicants (from the shared job link, no sign-in), and the
 * trainings assigned to employees. Shapes match the website's (lib/types.ts).
 */
@Injectable()
export class OnboardingService {
  private applications: number[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Requisitions ----------

  private requisitionView(r: ReqRow) {
    const since = Date.now() - WEEK_MS;
    return {
      id: r.id,
      title: r.title,
      department: r.department,
      ...(r.cluster ? { cluster: r.cluster } : {}),
      office: r.office,
      openings: r.openings,
      applicants: r.applicants.length,
      applicantsThisWeek: r.applicants.filter((a) => a.appliedAt.getTime() >= since).length,
      stage: r.stage,
      approval: r.approval,
      ...(r.employmentType ? { employmentType: r.employmentType } : {}),
      ...(r.targetStart ? { targetStart: utcDateToDateKey(r.targetStart) } : {}),
      ...(r.salaryRange ? { salaryRange: r.salaryRange } : {}),
      ...(r.justification ? { justification: r.justification } : {}),
      // Who signed off each step (the website shows only the approval label for now).
      ...(r.l1ApprovedBy ? { l1ApprovedBy: r.l1ApprovedBy, l1ApprovedAt: r.l1ApprovedAt?.toISOString() } : {}),
      ...(r.l2ApprovedBy ? { l2ApprovedBy: r.l2ApprovedBy, l2ApprovedAt: r.l2ApprovedAt?.toISOString() } : {}),
    };
  }

  async requisitions(openOnly = false) {
    const rows = await this.prisma.jobRequisition.findMany({
      // Declined requisitions stay on record but leave the list.
      where: openOnly ? { approval: 'Approved', openings: { gt: 0 }, declinedAt: null } : { declinedAt: null },
      include: { applicants: { select: { appliedAt: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.requisitionView(r));
  }

  /** New requisitions start with the Partner (L1), then go to HR and the Project Sponsor. */
  async createRequisition(input: RequisitionInput, user: AuthUser) {
    const targetStart = input.targetStart ? parseDate(input.targetStart) : null;
    if (input.targetStart && !targetStart) throw new BadRequestException('Enter the target start date');
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.jobRequisition.create({
        data: { ...input, targetStart, stage: 'Sourcing', approval: 'Pending L1', createdBy: user.displayName, createdById: user.userId },
        include: { applicants: { select: { appliedAt: true } } },
      });
      await this.audit.log({ actorId: user.userId, action: 'REQUISITION_ADDED', entity: 'JobRequisition', entityId: r.id, after: { title: r.title, office: r.office, openings: r.openings } }, tx);
      return r;
    });
    return this.requisitionView(row);
  }

  /**
   * Sign off the step the requisition is at: L1 by the Partner (approver) or a Super Admin, then L2 by HR or a
   * Super Admin, after which it's Approved and on the job link. Whoever asked for it can't give the L1 sign-off
   * (the Partner's is the independent check); HR may confirm L2 on one it raised.
   */
  async approveRequisition(id: string, user: AuthUser) {
    const r = await this.pending(id);
    const l1 = r.approval === 'Pending L1';
    const allowed = l1 ? user.role === 'MANAGER' || user.role === 'SYSTEM_ADMIN' : user.role === 'HR_ADMIN' || user.role === 'SYSTEM_ADMIN';
    if (!allowed) throw new ForbiddenException(l1 ? 'The Partner approves this step first' : 'HR approves this step');
    if (l1 && r.createdById === user.userId) throw new ForbiddenException("You can't give the first approval on a requisition you asked for");
    const now = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      // Only flip a requisition still at this step, so two approvers can't both pass it.
      const { count } = await tx.jobRequisition.updateMany({
        where: { id, approval: r.approval, declinedAt: null },
        data: l1 ? { approval: 'Pending L2', l1ApprovedBy: user.displayName, l1ApprovedAt: now } : { approval: 'Approved', l2ApprovedBy: user.displayName, l2ApprovedAt: now },
      });
      if (!count) throw new ConflictException('Someone else just decided this requisition');
      await this.audit.log({ actorId: user.userId, action: l1 ? 'REQUISITION_APPROVED_L1' : 'REQUISITION_APPROVED', entity: 'JobRequisition', entityId: id, before: { approval: r.approval }, after: { approval: l1 ? 'Pending L2' : 'Approved', title: r.title } }, tx);
      return tx.jobRequisition.findUniqueOrThrow({ where: { id }, include: { applicants: { select: { appliedAt: true } } } });
    });
    return this.requisitionView(row);
  }

  /** Decline at either step, with the reason. It leaves the list and never reaches the job link. */
  async declineRequisition(id: string, reason: string, user: AuthUser) {
    const r = await this.pending(id);
    const l1 = r.approval === 'Pending L1';
    const allowed = l1 ? user.role === 'MANAGER' || user.role === 'SYSTEM_ADMIN' : user.role === 'HR_ADMIN' || user.role === 'SYSTEM_ADMIN';
    if (!allowed) throw new ForbiddenException(l1 ? 'The Partner decides this step first' : 'HR decides this step');
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.jobRequisition.updateMany({
        where: { id, approval: r.approval, declinedAt: null },
        data: { declinedBy: user.displayName, declinedAt: new Date(), declineReason: reason },
      });
      if (!count) throw new ConflictException('Someone else just decided this requisition');
      await this.audit.log({ actorId: user.userId, action: 'REQUISITION_DECLINED', entity: 'JobRequisition', entityId: id, before: { approval: r.approval }, after: { reason, title: r.title } }, tx);
    });
  }

  /** A requisition still waiting for a decision. */
  private async pending(id: string) {
    const r = await this.prisma.jobRequisition.findUnique({ where: { id } });
    if (!r || r.declinedAt) throw new NotFoundException('That requisition no longer exists');
    if (r.approval === 'Approved') throw new ConflictException('This requisition is already approved');
    return r;
  }

  // ---------- Applicants ----------

  private applicantView(a: ApplicantRow) {
    return {
      ...(a.profile as Record<string, unknown>),
      id: a.id,
      requisitionId: a.requisitionId,
      firstName: a.firstName,
      lastName: a.lastName,
      ...(a.email ? { email: a.email } : {}),
      ...(a.phone ? { phone: a.phone } : {}),
      stage: a.stage,
      appliedAt: a.appliedAt.toISOString(),
      ...(a.source ? { source: a.source } : {}),
      ...(a.note ? { note: a.note } : {}),
    };
  }

  async applicants() {
    const rows = await this.prisma.applicant.findMany({ orderBy: { appliedAt: 'desc' } });
    return rows.map((a) => this.applicantView(a));
  }

  async moveApplicant(id: string, stage: string, user: AuthUser) {
    const a = await this.prisma.applicant.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('That applicant no longer exists');
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.applicant.update({ where: { id }, data: { stage } });
      await this.audit.log({ actorId: user.userId, action: 'APPLICANT_MOVED', entity: 'Applicant', entityId: id, before: { stage: a.stage }, after: { stage } }, tx);
      return r;
    });
    return this.applicantView(row);
  }

  /** Someone applies through the shared link (no sign-in); they land in the role's Applied column. */
  async apply(input: ApplicationInput) {
    const now = Date.now();
    this.applications = this.applications.filter((t) => now - t < 3_600_000);
    if (this.applications.length >= APPLICATIONS_PER_HOUR)
      throw new HttpException('Too many applications right now. Please try again in an hour.', HttpStatus.TOO_MANY_REQUESTS);

    let role = input.requisitionId
      ? await this.prisma.jobRequisition.findUnique({ where: { id: input.requisitionId } })
      : await this.prisma.jobRequisition.findFirst({ where: { approval: 'Approved', openings: { gt: 0 }, title: { equals: input.appliedRole, mode: 'insensitive' } } });
    if (input.requisitionId && (!role || role.approval !== 'Approved' || role.openings <= 0)) throw new BadRequestException('This role is no longer open.');
    // A role from the catalog with no opening yet still reaches HR: it gets its own pipeline in Recruitment.
    if (!role)
      role = await this.prisma.jobRequisition.create({
        data: { title: input.appliedRole, department: input.field || 'Other', office: 'Cebu HQ', openings: 1, stage: 'Sourcing', approval: 'Approved', createdBy: 'Shared job link' },
      });
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.applicant.findFirst({ where: { requisitionId: role.id, email } }))
      throw new ConflictException(`You've already applied for ${role.title} with this email. HR will contact you there.`);
    this.applications.push(now);

    const { requisitionId: _r, appliedRole: _a, field: _f, firstName, lastName, phone, email: _e, ...rest } = input;
    void _r, void _a, void _f, void _e;
    const day = new Date(now).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
    const row = await this.prisma.applicant.create({
      data: {
        id: `ap-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        requisitionId: role.id,
        firstName,
        lastName,
        email,
        phone,
        stage: 'Applied',
        source: 'Shared link',
        note: `Shared link · ${day}`,
        profile: rest as Prisma.InputJsonValue,
      },
    });
    return this.applicantView(row);
  }

  // ---------- Trainings ----------

  private trainingView(t: TrainingRow): TrainingView {
    return {
      id: t.id,
      employeeName: `${t.employee.firstName} ${t.employee.lastName}`,
      employeeInitials: initials(t.employee.firstName, t.employee.lastName),
      course: t.course,
      dueDate: showDate(t.dueDate),
      status: t.status as TrainingView['status'],
    };
  }

  /** HR and System Admin: everyone; a manager: their team; anyone else: their own. */
  async trainings(user: AuthUser, teamIds?: string[]) {
    const all = user.role === 'HR_ADMIN' || user.role === 'SYSTEM_ADMIN';
    const ids = all ? undefined : (teamIds ?? (user.employeeId ? [user.employeeId] : []));
    const rows = await this.prisma.trainingRecord.findMany({
      where: ids ? { employeeId: { in: ids } } : {},
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((t) => this.trainingView(t));
  }

  /** The website names the employee; it must be one current employee. */
  async assignTraining(input: TrainingInput, user: AuthUser) {
    const due = parseDate(input.dueDate);
    if (!due) throw new BadRequestException('Enter the due date, e.g. Nov 15, 2026');
    const people = (await this.prisma.employee.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true } })).filter(
      (e) => `${e.firstName} ${e.lastName}`.toLowerCase() === input.employeeName.toLowerCase(),
    );
    if (people.length !== 1) throw new BadRequestException(people.length ? 'Two employees have that name; ask IT to assign it' : 'Choose a current employee');
    const row = await this.prisma.$transaction(async (tx) => {
      const t = await tx.trainingRecord.create({
        data: { employeeId: people[0]!.id, course: input.course, dueDate: due, assignedBy: user.displayName },
        include: { employee: { select: { firstName: true, lastName: true } } },
      });
      await this.audit.log({ actorId: user.userId, action: 'TRAINING_ASSIGNED', entity: 'TrainingRecord', entityId: t.id, after: { employee: input.employeeName, course: input.course, due: utcDateToDateKey(due) } }, tx);
      return t;
    });
    return this.trainingView(row);
  }

  /** HR sets any status; an employee only moves their own forward (started, completed), never back. */
  async setTrainingStatus(id: string, status: string, user: AuthUser, own: boolean) {
    const t = await this.prisma.trainingRecord.findUnique({ where: { id } });
    if (!t || (own && t.employeeId !== user.employeeId)) throw new NotFoundException("That training isn't assigned to you");
    const order = ['Not started', 'In progress', 'Completed'];
    if (own && order.indexOf(status) <= order.indexOf(t.status)) {
      const same = await this.prisma.trainingRecord.findUniqueOrThrow({ where: { id }, include: { employee: { select: { firstName: true, lastName: true } } } });
      return this.trainingView(same);
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.trainingRecord.update({ where: { id }, data: { status }, include: { employee: { select: { firstName: true, lastName: true } } } });
      await this.audit.log({ actorId: user.userId, action: 'TRAINING_STATUS', entity: 'TrainingRecord', entityId: id, before: { status: t.status }, after: { status } }, tx);
      return r;
    });
    return this.trainingView(row);
  }

  async removeTraining(id: string, user: AuthUser) {
    const t = await this.prisma.trainingRecord.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('That training no longer exists');
    await this.prisma.$transaction(async (tx) => {
      await tx.trainingRecord.delete({ where: { id } });
      await this.audit.log({ actorId: user.userId, action: 'TRAINING_REMOVED', entity: 'TrainingRecord', entityId: id, before: { course: t.course } }, tx);
    });
  }
}
