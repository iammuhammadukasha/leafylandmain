import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  VendorOrderLinePage,
  VendorOrderLineView,
  VendorOrderLineViewRepository,
} from '../../domain/repositories/vendor-order-line-view.repository';

/**
 * Read-model query backing GET /vendors/me/orders (FR-ORD-006) — see the
 * port's doc comment for why this is a dedicated flat/paginated query
 * rather than a method on PrismaOrderRepository. Joins order_lines (this
 * vendor's only) with their containing order (for orderId — already
 * denormalized onto the line, no join needed there) and the matching
 * shipment row if one exists (matched by (orderId, vendorId), same
 * grouping key the Shipment entity uses).
 */
@Injectable()
export class PrismaVendorOrderLineViewRepository implements VendorOrderLineViewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByVendorId(
    vendorId: string,
    page: number,
    pageSize: number,
  ): Promise<VendorOrderLinePage> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.orderLine.findMany({
        where: { vendorId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.orderLine.count({ where: { vendorId, deletedAt: null } }),
    ]);

    const orderIds = [...new Set(rows.map((r) => r.orderId))];
    const shipments = await this.prisma.shipment.findMany({
      where: { vendorId, orderId: { in: orderIds }, deletedAt: null },
    });
    const shipmentByOrderId = new Map(
      shipments.map((s) => [s.orderId, s.status]),
    );

    // FR-ORD-005 — join in each line's Return row, if any (at most one per
    // line, Return.orderLineId is DB-unique), so the vendor-orders UI can
    // show/act on pending return requests without a separate endpoint.
    const lineIds = rows.map((r) => r.id);
    const returns = await this.prisma.return.findMany({
      where: { orderLineId: { in: lineIds }, deletedAt: null },
    });
    const returnByLineId = new Map(returns.map((r) => [r.orderLineId, r]));

    const items: VendorOrderLineView[] = rows.map((row) => {
      const returnRow = returnByLineId.get(row.id);
      return {
        orderLineId: row.id,
        orderId: row.orderId,
        productVariantId: row.productVariantId,
        quantity: row.quantity,
        unitPriceMinor: row.unitPriceMinor,
        lineStatus: row.status,
        shipmentStatus: shipmentByOrderId.get(row.orderId) ?? null,
        createdAt: row.createdAt,
        returnId: returnRow?.id ?? null,
        returnStatus: returnRow?.status ?? null,
      };
    });

    return { items, total };
  }
}
