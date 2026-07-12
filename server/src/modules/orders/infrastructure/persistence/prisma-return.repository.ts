import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { ReturnRepository } from '../../domain/repositories/return.repository';
import { Return, type ReturnProps } from '../../domain/entities/return.entity';
import type { Return as PrismaReturn } from '@prisma/client';

@Injectable()
export class PrismaReturnRepository implements ReturnRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Return | null> {
    const row = await this.prisma.return.findUnique({ where: { id } });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async findByOrderLineId(orderLineId: string): Promise<Return | null> {
    const row = await this.prisma.return.findUnique({
      where: { orderLineId },
    });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async save(returnEntity: Return): Promise<void> {
    const props = returnEntity.snapshot;

    await this.prisma.return.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        orderLineId: props.orderLineId,
        reason: props.reason,
        status: props.status,
        resolvedBy: props.resolvedBy,
        refundId: props.refundId,
        version: props.version,
      },
      update: {
        status: props.status,
        resolvedBy: props.resolvedBy,
        refundId: props.refundId,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaReturn): Return {
    const props: ReturnProps = {
      id: row.id,
      orderLineId: row.orderLineId,
      reason: row.reason,
      status: row.status,
      resolvedBy: row.resolvedBy,
      refundId: row.refundId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Return.reconstitute(props);
  }
}
