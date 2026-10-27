import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@msma/db';
import { FileTicket, TicketPatch } from '@msma/shared';
import type { AuthUser } from '../common/auth.decorators';
import { isPlatformAdmin } from '../common/platform';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type Row = Prisma.SupportTicketGetPayload<{ include: { messages: true } }>;

/** The workspace someone files from: the HR workspace shares its tickets; the others stay private. */
const workspaceOf = (user: AuthUser) => (user.role === 'EMPLOYEE' ? 'employee' : user.role === 'MANAGER' ? 'manager' : 'admin');

/**
 * Support tickets, as the website's own (lib/support/store.ts): our team (PLATFORM_ADMIN_EMAILS) sees and answers
 * every ticket; the client's HR workspace shares the tickets filed there; anyone else sees only their own.
 */
@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private view(t: Row) {
    return {
      id: t.id,
      number: t.number,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      filedBy: t.filedBy,
      filedById: t.filedById,
      ...(t.filedByEmployeeId ? { filedByEmployeeId: t.filedByEmployeeId } : {}),
      workspace: t.workspace,
      ...(t.page ? { page: t.page } : {}),
      ...(t.assignee ? { assignee: t.assignee } : {}),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      messages: [...t.messages].sort((a, b) => a.at.getTime() - b.at.getTime()).map((m) => ({ id: m.id, by: m.by, side: m.side, text: m.text, at: m.at.toISOString() })),
    };
  }

  private visible(user: AuthUser): Prisma.SupportTicketWhereInput {
    if (isPlatformAdmin(user)) return {};
    return workspaceOf(user) === 'admin' ? { OR: [{ filedById: user.userId }, { workspace: 'admin' }] } : { filedById: user.userId };
  }

  private async open(id: string, user: AuthUser) {
    const t = await this.prisma.supportTicket.findFirst({ where: { id, ...this.visible(user) }, include: { messages: true } });
    if (!t) throw new NotFoundException('That ticket is gone.');
    return t;
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.supportTicket.findMany({ where: this.visible(user), include: { messages: true }, orderBy: { updatedAt: 'desc' } });
    return rows.map((t) => this.view(t));
  }

  async file(input: FileTicket, user: AuthUser) {
    const support = isPlatformAdmin(user);
    const row = await this.prisma.$transaction(async (tx) => {
      const last = await tx.supportTicket.aggregate({ _max: { number: true } });
      const t = await tx.supportTicket.create({
        data: {
          number: Math.max(1000, last._max.number ?? 0) + 1,
          subject: input.subject,
          category: input.category,
          priority: input.priority,
          filedBy: user.displayName,
          filedById: user.userId,
          filedByEmployeeId: user.employeeId,
          workspace: workspaceOf(user),
          page: input.page ?? null,
          messages: { create: { by: user.displayName, side: support ? 'support' : 'client', text: input.text } },
        },
        include: { messages: true },
      });
      await this.audit.log({ actorId: user.userId, action: 'SUPPORT_TICKET_FILED', entity: 'SupportTicket', entityId: t.id, after: { number: t.number, subject: t.subject } }, tx);
      return t;
    });
    if (!support) await this.notifications.send({ topic: 'support', kind: 'request', title: `New support ticket #${row.number}: ${row.subject}`, body: `${user.displayName} · ${row.category} · ${row.priority} priority.`, roles: ['PLATFORM_ADMIN'], actorId: user.userId });
    return this.view(row);
  }

  /** A client's reply reopens a ticket waiting on them or resolved; our reply moves an open one to in progress. */
  async reply(id: string, text: string, user: AuthUser) {
    const t = await this.open(id, user);
    const support = isPlatformAdmin(user);
    const status = support ? (t.status === 'open' ? 'in_progress' : t.status) : t.status === 'waiting' || t.status === 'resolved' ? 'open' : t.status;
    const row = await this.prisma.supportTicket.update({
      where: { id },
      data: { status, updatedAt: new Date(), messages: { create: { by: support ? 'Support team' : user.displayName, side: support ? 'support' : 'client', text } } },
      include: { messages: true },
    });
    // Our reply tells whoever filed it; their reply tells our team.
    await this.notifications.send(
      support
        ? { topic: 'support', kind: 'update', title: `Support replied to ticket #${t.number}`, body: text.slice(0, 140), userIds: [t.filedById], actorId: user.userId }
        : { topic: 'support', kind: 'update', title: `${user.displayName} replied on ticket #${t.number}`, body: text.slice(0, 140), roles: ['PLATFORM_ADMIN'], actorId: user.userId },
    );
    return this.view(row);
  }

  /** Our team only: status, priority and who's on it. */
  async update(id: string, patch: TicketPatch, user: AuthUser) {
    const before = await this.open(id, user);
    const row = await this.prisma.supportTicket.update({ where: { id }, data: { ...patch, updatedAt: new Date() }, include: { messages: true } });
    const LABEL: Record<string, string> = { open: 'Open', in_progress: 'In progress', waiting: 'Waiting for you', resolved: 'Resolved', closed: 'Closed' };
    if (patch.status && patch.status !== before.status)
      await this.notifications.send({ topic: 'support', kind: 'update', title: `Ticket #${row.number} is now ${LABEL[patch.status]}`, body: row.subject, userIds: [row.filedById], actorId: user.userId });
    return this.view(row);
  }

  /** The client may close their own ticket once it's sorted. */
  async close(id: string, user: AuthUser) {
    await this.open(id, user);
    const row = await this.prisma.supportTicket.update({ where: { id }, data: { status: 'closed', updatedAt: new Date() }, include: { messages: true } });
    return this.view(row);
  }
}
