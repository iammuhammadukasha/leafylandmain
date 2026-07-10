import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { SessionRepository } from '../../domain/repositories/session.repository';
import {
  Session,
  type SessionProps,
} from '../../domain/entities/session.entity';
import type { Session as PrismaSession } from '@prisma/client';

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(session: Session): Promise<void> {
    const props = session.snapshot;
    await this.prisma.session.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        userId: props.userId,
        refreshTokenHash: props.refreshTokenHash,
        deviceLabel: props.deviceLabel,
        ipAddress: props.ipAddress,
        userAgent: props.userAgent,
        familyId: props.familyId,
        revokedAt: props.revokedAt,
      },
      update: {
        revokedAt: props.revokedAt,
        version: { increment: 1 },
      },
    });
  }

  async findById(id: string): Promise<Session | null> {
    const row = await this.prisma.session.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByRefreshTokenHash(hash: string): Promise<Session | null> {
    const row = await this.prisma.session.findFirst({
      where: { refreshTokenHash: hash },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toDomain(row) : null;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  private toDomain(row: PrismaSession): Session {
    const props: SessionProps = {
      id: row.id,
      userId: row.userId,
      refreshTokenHash: row.refreshTokenHash,
      deviceLabel: row.deviceLabel,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      familyId: row.familyId,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    return Session.reconstitute(props);
  }
}
