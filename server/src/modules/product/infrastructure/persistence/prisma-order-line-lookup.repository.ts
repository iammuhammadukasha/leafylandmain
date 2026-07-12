import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  OrderLineLookupRepository,
  OrderLineSummary,
} from '../../domain/repositories/order-line-lookup.repository';

/**
 * Read-only lookup over the Orders-context `order_lines`/`orders` tables
 * (Volume 04 §6), scoped to the one query SubmitReviewUseCase needs: "does
 * this order line exist, who does it belong to, which variant is it for,
 * and what's the containing order's payment status?" See the port's doc
 * comment (domain/repositories/order-line-lookup.repository.ts) for why
 * this lives in Product's own infrastructure layer rather than importing
 * Orders' PrismaOrderRepository/domain entity directly — same cross-context
 * discipline as Orders' own PrismaProductLookupRepository, just the reverse
 * direction.
 */
@Injectable()
export class PrismaOrderLineLookupRepository implements OrderLineLookupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<OrderLineSummary | null> {
    const row = await this.prisma.orderLine.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!row || row.deletedAt || !row.order || row.order.deletedAt) {
      return null;
    }
    return {
      id: row.id,
      orderId: row.orderId,
      orderUserId: row.order.userId,
      productVariantId: row.productVariantId,
      orderStatus: row.order.status,
      lineStatus: row.status,
    };
  }
}
