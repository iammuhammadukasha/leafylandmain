import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  AuditEvent,
  AuditLogger,
} from '../../application/ports/audit-logger.port';
import type { Prisma } from '@prisma/client';

/**
 * Append-only audit_log writer (Volume 04 §2, Architecture §7.1). Called
 * explicitly from application-layer use cases at the point of a
 * state change — never via generic ORM hooks.
 */
@Injectable()
export class PrismaAuditLogger implements AuditLogger {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        diff: (event.diff ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: event.ipAddress,
      },
    });
  }
}
