import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@msma/db';
import { PrismaService } from '../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Append an audit entry. Pass the transaction client to record it atomically with the change. */
  async log(
    entry: {
      actorId: string | null;
      action: string;
      entity: string;
      entityId: string;
      before?: unknown;
      after?: unknown;
    },
    db: Db = this.prisma,
  ) {
    const toJson = (v: unknown) =>
      v === undefined || v === null
        ? Prisma.JsonNull
        : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);
    await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        before: toJson(entry.before),
        after: toJson(entry.after),
      },
    });
  }

  /** Audit trail of one record, newest first. */
  forEntity(entity: string, entityId: string, take = 100) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      include: { actor: { select: { displayName: true, role: true } } },
      orderBy: { at: 'desc' },
      take,
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
