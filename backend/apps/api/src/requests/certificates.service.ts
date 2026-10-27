import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import type { AuthUser } from '../common/auth.decorators';
import { notSelf } from '../common/not-self';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type Row = Prisma.CertificateRequestGetPayload<{ include: { employee: { include: { site: true; department: true; position: true } } } }>;
interface Issued {
  number: string;
  statement: string;
  purpose: string;
  issuedAt: string;
  issuedBy: string;
}

const PREFIX: Record<string, string> = { 'Certificate of Employment': 'COE', 'Certificate of Tax Withheld (2316)': 'BIR2316', 'Employment Verification Letter': 'EVL' };
const STATUS: Record<string, string> = { PROBATIONARY: 'Probationary', REGULAR: 'Regular', CONTRACTUAL: 'Contractual', PROJECT: 'Project-based' };
const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The certificate's wording, made from the employee's record, as the website's (lib/certificates.ts). */
function statementOf(e: Row['employee'], type: string) {
  const name = esc(`${e.firstName} ${e.lastName}`);
  const id = esc(e.employeeNo);
  const position = esc(e.position?.title ?? 'Employee');
  const dept = esc(e.department?.name ?? '');
  if (type === 'Certificate of Employment')
    return `This is to certify that <strong>${name}</strong> (Employee ID ${id}) is an employee of MSMA Group in ${esc(STATUS[e.status] ?? 'Regular').toLowerCase()} status, holding the position of <strong>${position}</strong> under the ${dept} department, ${esc(e.cluster ?? '')}, ${esc(e.site.name)} office.`;
  if (type === 'Certificate of Tax Withheld (2316)')
    return `This certifies that BIR Form 2316 for <strong>${name}</strong> (Employee ID ${id}) has been prepared and released by MSMA Group for the applicable taxable year.`;
  return `This is to certify that <strong>${name}</strong> (Employee ID ${id}) is employed with MSMA Group as <strong>${position}</strong>, ${dept} department.`;
}

/**
 * Certificates: an employee asks; HR sends a digital copy (released at once), or prepares a signed copy for pickup and
 * marks it released, or declines with a reason. Issuing files the exact copy (number like COE-2026-0001 and wording)
 * on the request, so it never changes with the record. The employee is told at each step.
 */
@Injectable()
export class CertificatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private include = { employee: { include: { site: true, department: true, position: true } } } as const;

  private view(r: Row) {
    return {
      id: r.id,
      type: r.type,
      purpose: r.purpose,
      status: r.status,
      requestedOn: r.requestedOn.toISOString().slice(0, 10),
      employeeId: r.employee.employeeNo,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      ...(r.handledBy ? { handledBy: r.handledBy, handledAt: r.handledAt?.toISOString() } : {}),
      ...(r.delivery ? { delivery: r.delivery } : {}),
      ...(r.note ? { note: r.note } : {}),
      ...(r.issued ? { issued: r.issued as unknown as Issued } : {}),
      ...(r.status === 'Released' && r.handledAt ? { releasedOn: r.handledAt.toISOString().slice(0, 10) } : {}),
    };
  }

  async mine(user: AuthUser) {
    const rows = await this.prisma.certificateRequest.findMany({ where: { employeeId: user.employeeId ?? '-' }, include: this.include, orderBy: { requestedOn: 'desc' } });
    return rows.map((r) => this.view(r));
  }

  async all() {
    const rows = await this.prisma.certificateRequest.findMany({ include: this.include, orderBy: { requestedOn: 'desc' } });
    return rows.map((r) => this.view(r));
  }

  async request(input: { type: string; purpose: string }, user: AuthUser) {
    if (!user.employeeId) throw new ForbiddenException('Only employees request certificates');
    const row = await this.prisma.$transaction(async (tx) => {
      const r = await tx.certificateRequest.create({ data: { employeeId: user.employeeId!, type: input.type, purpose: input.purpose }, include: this.include });
      await this.audit.log({ actorId: user.userId, action: 'CERTIFICATE_REQUESTED', entity: 'CertificateRequest', entityId: r.id, after: { type: input.type, purpose: input.purpose } }, tx);
      return r;
    });
    await this.notifications.send({ topic: 'certificate', kind: 'request', title: `${user.displayName} requested a ${input.type}`, body: `${input.purpose ? `For: ${input.purpose}. ` : ''}Prepare it and mark it ready for pickup under Requests › Certificates.`, roles: ['HR_ADMIN'], actorId: user.userId });
    return this.view(row);
  }

  /** The employee withdraws a request HR hasn't acted on yet. */
  async cancel(id: string, user: AuthUser) {
    const r = await this.prisma.certificateRequest.findUnique({ where: { id } });
    if (!r || r.employeeId !== user.employeeId) throw new NotFoundException('That request no longer exists');
    if (r.status !== 'Pending') throw new ConflictException(`This request is already ${r.status.toLowerCase()}`);
    await this.prisma.$transaction(async (tx) => {
      await tx.certificateRequest.delete({ where: { id } });
      await this.audit.log({ actorId: user.userId, action: 'CERTIFICATE_WITHDRAWN', entity: 'CertificateRequest', entityId: id, before: { type: r.type } }, tx);
    });
  }

  /** The next number for this type this year, e.g. COE-2026-0003. */
  private async nextNumber(type: string) {
    const prefix = `${PREFIX[type] ?? 'CERT'}-${new Date().getFullYear()}-`;
    const rows = await this.prisma.certificateRequest.findMany({ where: { issued: { not: Prisma.AnyNull } }, select: { issued: true } });
    const used = rows.map((r) => (r.issued as unknown as Issued | null)?.number).filter((n): n is string => !!n?.startsWith(prefix)).map((n) => Number(n.slice(prefix.length)) || 0);
    return `${prefix}${String(Math.max(0, ...used) + 1).padStart(4, '0')}`;
  }

  private async handle(id: string, from: string[], change: (r: Row) => Promise<Prisma.CertificateRequestUpdateInput>, user: AuthUser, action: string) {
    const r = await this.prisma.certificateRequest.findUnique({ where: { id }, include: this.include });
    if (!r) throw new NotFoundException('That request no longer exists');
    if (!from.includes(r.status)) throw new ConflictException(`This request is already ${r.status.toLowerCase()}`);
    notSelf(user, r.employeeId, 'handle a certificate request');
    const data = await change(r);
    const row = await this.prisma.$transaction(async (tx) => {
      // Only a request still in the state it was read in changes (two HR people acting at once can't both issue it).
      const { count } = await tx.certificateRequest.updateMany({ where: { id, status: r.status }, data: { ...(data as Prisma.CertificateRequestUpdateManyMutationInput), handledBy: user.displayName, handledAt: new Date() } });
      if (!count) throw new ConflictException('Someone else just handled this request');
      const u = await tx.certificateRequest.findUniqueOrThrow({ where: { id }, include: this.include });
      await this.audit.log({ actorId: user.userId, action, entity: 'CertificateRequest', entityId: id, before: { status: r.status }, after: { status: u.status, number: (u.issued as unknown as Issued | null)?.number ?? null } }, tx);
      return u;
    });
    return row;
  }

  private async fileCopy(r: Row, user: AuthUser): Promise<Issued> {
    return { number: await this.nextNumber(r.type), statement: statementOf(r.employee, r.type), purpose: r.purpose, issuedAt: new Date().toISOString(), issuedBy: user.displayName };
  }

  /** A digital copy: released at once; the employee downloads or prints it. */
  async issue(id: string, user: AuthUser) {
    const row = await this.handle(id, ['Pending', 'Ready for pickup'], async (r) => ({ status: 'Released', delivery: 'digital', issued: (r.issued ?? (await this.fileCopy(r, user))) as object }), user, 'CERTIFICATE_ISSUED');
    await this.notifications.send({ topic: 'certificate', kind: 'approved', title: `Your ${row.type} is ready`, body: `${user.displayName} sent it (No. ${(row.issued as unknown as Issued).number}). Download or print it from Certificates.`, employeeIds: [row.employeeId], actorId: user.userId });
    return this.view(row);
  }

  /** A signed paper copy to collect from HR. */
  async ready(id: string, user: AuthUser) {
    const row = await this.handle(id, ['Pending'], async () => ({ status: 'Ready for pickup', delivery: 'pickup' }), user, 'CERTIFICATE_READY');
    await this.notifications.send({ topic: 'certificate', kind: 'approved', title: `Your ${row.type} is ready for pickup`, body: `${user.displayName} prepared a signed copy. Pick it up from HR.`, employeeIds: [row.employeeId], actorId: user.userId });
    return this.view(row);
  }

  /** The signed copy was handed over (and its copy filed). */
  async released(id: string, user: AuthUser) {
    const row = await this.handle(id, ['Ready for pickup'], async (r) => ({ status: 'Released', ...(r.issued ? {} : { issued: (await this.fileCopy(r, user)) as object }) }), user, 'CERTIFICATE_RELEASED');
    await this.notifications.send({ topic: 'certificate', kind: 'update', title: `You received your ${row.type}`, body: `Released by ${user.displayName}. A digital copy is on your Certificates page too.`, employeeIds: [row.employeeId], actorId: user.userId });
    return this.view(row);
  }

  async decline(id: string, reason: string, user: AuthUser) {
    const row = await this.handle(id, ['Pending'], async () => ({ status: 'Declined', note: reason }), user, 'CERTIFICATE_DECLINED');
    await this.notifications.send({ topic: 'certificate', kind: 'rejected', title: `Your ${row.type} request was declined`, body: `${user.displayName}: "${reason}"`, employeeIds: [row.employeeId], actorId: user.userId });
    return this.view(row);
  }
}
