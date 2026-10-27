import { BadRequestException, Injectable } from '@nestjs/common';
import { ApprovalType, Role, Workflow, WorkflowStep } from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const KEY = 'workflows';

/** As the website's defaults (lib/admin/store.ts): the supervisor decides; profile changes go to HR. */
const DEFAULT_WORKFLOWS: Workflow[] = [
  { kind: 'leave', steps: [{ approver: 'supervisor' }], remindAfterDays: 2, active: true },
  { kind: 'overtime', steps: [{ approver: 'supervisor' }], remindAfterDays: 2, active: true },
  { kind: 'undertime', steps: [{ approver: 'supervisor' }], remindAfterDays: 2, active: true },
  { kind: 'correction', steps: [{ approver: 'supervisor' }], remindAfterDays: 1, active: true },
  { kind: 'profile', steps: [{ approver: 'role', roleId: 'hr' }], remindAfterDays: 3, active: true },
];

const KIND_OF: Record<ApprovalType, Workflow['kind']> = { LEAVE: 'leave', OT: 'overtime', UNDERTIME: 'undertime', DTR_FIX: 'correction' };
/** The website's role ids, as backend roles. */
const ROLE_OF: Record<string, Role> = {
  'system-admin': 'PLATFORM_ADMIN',
  'super-admin': 'SYSTEM_ADMIN',
  hr: 'HR_ADMIN',
  approver: 'MANAGER',
  accounting: 'PAYROLL_ADMIN',
  employee: 'EMPLOYEE',
};
const ROLE_NAME: Record<string, string> = { 'super-admin': 'Super Admin', hr: 'HR', approver: 'Approver', accounting: 'Accounting', employee: 'Employee', 'system-admin': 'System Admin' };
const STEP_NAME = { supervisor: 'Manager or supervisor', 'department-head': 'Department head' } as const;

/**
 * Approval workflows (Maintenance > Rules on the website): for each kind of request, up to 3 steps, each the
 * employee's supervisor, their department head or anyone with a role, optionally only past a number of days.
 * A request copies the steps that apply when it's filed; the Super Admin may decide any step.
 */
@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<Workflow[]> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: KEY } });
    const saved = (row?.value as unknown as Workflow[] | undefined) ?? [];
    return DEFAULT_WORKFLOWS.map((d) => saved.find((w) => w.kind === d.kind) ?? d);
  }

  async save(input: Workflow, user: AuthUser): Promise<Workflow> {
    if (input.steps.length === 0) throw new BadRequestException('Add at least one approval step');
    if (input.steps.length > 3) throw new BadRequestException("Keep it to 3 steps or fewer so requests don't get stuck");
    if (input.steps.some((s) => s.approver === 'role' && !(s.roleId && ROLE_OF[s.roleId]))) throw new BadRequestException("Choose the role for each 'Anyone with a role' step");
    // Only approvers and the Super Admin decide requests; HR handles profile changes (its own records work) and only looks
    // at the rest. Roles that can't decide would leave requests stuck.
    const deciders = input.kind === 'profile' ? ['approver', 'super-admin', 'hr'] : ['approver', 'super-admin'];
    if (input.steps.some((s) => s.approver === 'role' && !deciders.includes(s.roleId ?? '')))
      throw new BadRequestException(input.kind === 'profile' ? 'Only Approvers, HR or the Super Admin can decide profile changes' : 'Only Approvers or the Super Admin can decide these requests');
    const all = await this.list();
    const next = all.map((w) => (w.kind === input.kind ? input : w));
    await this.prisma.$transaction(async (tx) => {
      await tx.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: next as object }, update: { value: next as object } });
      await this.audit.log({ actorId: user.userId, action: 'WORKFLOW_CHANGED', entity: 'Workflow', entityId: input.kind, after: { name: input.kind, steps: this.describe(input.steps) } }, tx);
    });
    return input;
  }

  describe(steps: WorkflowStep[]) {
    return steps.map((s) => `${this.stepName(s)}${s.overDays ? ` (if over ${s.overDays} days)` : ''}`).join(' → ');
  }

  stepName(s: WorkflowStep) {
    return s.approver === 'role' ? (ROLE_NAME[s.roleId ?? ''] ?? 'A role') : STEP_NAME[s.approver];
  }

  /** The steps a new request goes through (long-leave steps only past their days); the supervisor when none apply. */
  async stepsFor(type: ApprovalType, days = 0): Promise<WorkflowStep[]> {
    const w = (await this.list()).find((x) => x.kind === KIND_OF[type] && x.active);
    const steps = w?.steps.filter((s) => !s.overDays || days > s.overDays) ?? [];
    return steps.length ? steps : [{ approver: 'supervisor' }];
  }

  /**
   * Who is told a request is waiting at this step: the manager with an Approver login (else the Super Admins), the
   * department head (else HR), or everyone with the role.
   */
  async approversOf(employeeId: string, step: WorkflowStep | undefined): Promise<{ employeeIds: string[]; roles: Role[] }> {
    const s = step ?? { approver: 'supervisor' as const };
    if (s.approver === 'role') return { employeeIds: [], roles: s.roleId && ROLE_OF[s.roleId] ? [ROLE_OF[s.roleId]] : [] };
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { managerId: true, siteId: true, departmentId: true } });
    if (s.approver === 'supervisor') {
      const ok = e?.managerId && (await this.prisma.user.count({ where: { employeeId: e.managerId, role: 'MANAGER', status: 'active' } }));
      return ok ? { employeeIds: [e!.managerId!], roles: [] } : { employeeIds: [], roles: ['SYSTEM_ADMIN'] };
    }
    const head = e?.departmentId
      ? (await this.prisma.siteDepartment.findUnique({ where: { siteId_departmentId: { siteId: e.siteId, departmentId: e.departmentId } }, select: { headEmployeeId: true } }))?.headEmployeeId
      : null;
    // No department head set: the Super Admin decides (HR only looks at requests).
    return head ? { employeeIds: [head], roles: [] } : { employeeIds: [], roles: ['SYSTEM_ADMIN'] };
  }

  /**
   * May this person decide the step a request is at? The Super Admin always may. A supervisor step: the employee's
   * manager with an active Approver login (no such login: only the Super Admin). A department-head step: the head set
   * in Maintenance > Departments (none: only the Super Admin). A role step: anyone with that role.
   */
  async canDecide(user: AuthUser, employeeId: string, step: WorkflowStep | undefined): Promise<boolean> {
    if (user.role === 'SYSTEM_ADMIN') return true;
    const s = step ?? { approver: 'supervisor' as const };
    const e = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { managerId: true, siteId: true, departmentId: true } });
    if (!e) return false;
    if (s.approver === 'supervisor') {
      if (!e.managerId || user.employeeId !== e.managerId || user.role !== 'MANAGER') return false;
      return true;
    }
    if (s.approver === 'department-head') {
      const head = e.departmentId
        ? (await this.prisma.siteDepartment.findUnique({ where: { siteId_departmentId: { siteId: e.siteId, departmentId: e.departmentId } }, select: { headEmployeeId: true } }))?.headEmployeeId
        : null;
      return !!head && user.employeeId === head && head !== employeeId;
    }
    return !!s.roleId && ROLE_OF[s.roleId] === user.role;
  }
}
