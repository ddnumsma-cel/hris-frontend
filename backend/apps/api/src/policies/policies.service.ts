import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import { dateKeyToUtcDate, PolicyInput, PolicyRowView, PolicyView, utcDateToDateKey } from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';
import { requireEmployeeId } from '../common/auth.decorators';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type Row = Prisma.PolicyGetPayload<object>;

const view = (p: Row): PolicyView => ({
  id: p.id,
  title: p.title,
  category: p.category as PolicyView['category'],
  version: p.version,
  effectiveDate: utcDateToDateKey(p.effectiveDate),
  summary: p.summary,
  body: p.body,
  ...(p.fileId ? { fileId: p.fileId } : {}),
  ...(p.fileName ? { fileName: p.fileName } : {}),
  requireAck: p.requireAck,
  status: p.status === 'published' || p.status === 'archived' ? p.status : 'draft',
  updatedBy: p.updatedBy,
  updatedAt: p.updatedAt.toISOString(),
});

/**
 * Company rules and policies: HR writes and publishes them, employees read them and confirm they did. Changing a
 * published policy's content makes a new version that everyone confirms again. Same rules as the website's own.
 */
@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Current employees: who should read the published policies. */
  private current() {
    return this.prisma.employee.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true } });
  }

  async list(): Promise<PolicyRowView[]> {
    const [policies, people, acks] = await Promise.all([this.prisma.policy.findMany(), this.current(), this.prisma.policyAck.findMany()]);
    const ids = new Set(people.map((p) => p.id));
    return policies
      .sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived') || a.title.localeCompare(b.title))
      .map((p) => ({
        ...view(p),
        acknowledged: new Set(acks.filter((a) => a.policyId === p.id && a.version === p.version && ids.has(a.employeeId)).map((a) => a.employeeId)).size,
        total: people.length,
      }));
  }

  async save(id: string | undefined, input: PolicyInput, user: AuthUser): Promise<PolicyView> {
    if (!input.body && !input.fileId) throw new BadRequestException('Write the policy or attach the document');
    const clash = await this.prisma.policy.findFirst({
      where: { title: { equals: input.title, mode: 'insensitive' }, status: { not: 'archived' }, ...(id ? { id: { not: id } } : {}) },
    });
    if (clash) throw new ConflictException("There's already a policy with that title");
    const old = id ? await this.prisma.policy.findUnique({ where: { id } }) : null;
    if (id && !old) throw new NotFoundException('That policy no longer exists');
    const contentChanged = !!old && (old.body !== input.body || (old.fileId ?? undefined) !== input.fileId || old.title !== input.title);
    const data = {
      title: input.title,
      category: input.category,
      version: old ? (old.status === 'published' && contentChanged ? old.version + 1 : old.version) : 1,
      effectiveDate: dateKeyToUtcDate(input.effectiveDate),
      summary: input.summary,
      body: input.body,
      fileId: input.fileId ?? null,
      fileName: input.fileName ?? null,
      requireAck: input.requireAck,
      updatedBy: user.displayName,
      updatedAt: new Date(),
    };
    const row = await this.prisma.$transaction(async (tx) => {
      const r = old
        ? await tx.policy.update({ where: { id: old.id }, data })
        : await tx.policy.create({ data: { id: `pol-${Date.now().toString(36)}`, status: 'draft', ...data } });
      await this.audit.log(
        { actorId: user.userId, action: old ? 'POLICY_CHANGED' : 'POLICY_ADDED', entity: 'Policy', entityId: r.id, after: { title: r.title, version: r.version, category: r.category } },
        tx,
      );
      return r;
    });
    return view(row);
  }

  async setStatus(id: string, status: 'draft' | 'published' | 'archived', user: AuthUser): Promise<void> {
    const p = await this.prisma.policy.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('That policy no longer exists');
    await this.prisma.$transaction(async (tx) => {
      await tx.policy.update({ where: { id }, data: { status, updatedBy: user.displayName, updatedAt: new Date() } });
      await this.audit.log({ actorId: user.userId, action: `POLICY_${status.toUpperCase()}`, entity: 'Policy', entityId: id, before: { status: p.status }, after: { status, title: p.title } }, tx);
    });
    // Company news: everyone hears about a newly published policy.
    if (status === 'published' && p.status !== 'published')
      await this.notifications.send({ topic: 'policy', kind: 'update', title: `New company policy: ${p.title}`, body: p.requireAck ? "Read it and confirm you've read it under Company policies." : 'Read it under Company policies.', roles: ['EMPLOYEE', 'MANAGER', 'HR_ADMIN', 'PAYROLL_ADMIN', 'SYSTEM_ADMIN'], actorId: user.userId });
  }

  /** Drafts only; published policies stay on record and are archived instead. */
  async remove(id: string, user: AuthUser): Promise<void> {
    const p = await this.prisma.policy.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('That policy no longer exists');
    if (p.status !== 'draft') throw new ConflictException('Published policies stay on record. Archive it instead.');
    await this.prisma.$transaction(async (tx) => {
      await tx.policy.delete({ where: { id } });
      await this.audit.log({ actorId: user.userId, action: 'POLICY_DELETED', entity: 'Policy', entityId: id, before: { title: p.title } }, tx);
    });
  }

  /** Who has and hasn't confirmed the current version. */
  async acknowledgements(id: string) {
    const p = await this.prisma.policy.findUnique({ where: { id } });
    if (!p) return { done: [], waiting: [] };
    const [people, acks] = await Promise.all([this.current(), this.prisma.policyAck.findMany({ where: { policyId: id, version: p.version } })]);
    const at = new Map(acks.map((a) => [a.employeeId, a.at.toISOString()]));
    const name = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`;
    return {
      done: people.filter((e) => at.has(e.id)).map((e) => ({ name: name(e), at: at.get(e.id)! })).sort((a, b) => a.name.localeCompare(b.name)),
      waiting: people.filter((e) => !at.has(e.id)).map(name).sort(),
    };
  }

  /** Published policies for the signed-in employee, the ones still to confirm first. */
  async mine(user: AuthUser) {
    const employeeId = requireEmployeeId(user);
    const [policies, acks] = await Promise.all([
      this.prisma.policy.findMany({ where: { status: 'published' } }),
      this.prisma.policyAck.findMany({ where: { employeeId } }),
    ]);
    return policies
      .map((p) => ({ ...view(p), acknowledgedAt: acks.find((a) => a.policyId === p.id && a.version === p.version)?.at.toISOString() }))
      .sort((a, b) => Number(!!a.acknowledgedAt) - Number(!!b.acknowledgedAt) || a.title.localeCompare(b.title));
  }

  async acknowledge(id: string, user: AuthUser): Promise<void> {
    const employeeId = requireEmployeeId(user);
    const p = await this.prisma.policy.findFirst({ where: { id, status: 'published' } });
    if (!p) throw new NotFoundException('That policy is no longer published');
    await this.prisma.policyAck.upsert({
      where: { policyId_version_employeeId: { policyId: id, version: p.version, employeeId } },
      create: { policyId: id, version: p.version, employeeId },
      update: {},
    });
  }
}
