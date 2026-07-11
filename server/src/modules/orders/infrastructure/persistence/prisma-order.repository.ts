import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { OrderRepository } from '../../domain/repositories/order.repository';
import { Order, type OrderProps } from '../../domain/entities/order.entity';
import type {
  Order as PrismaOrder,
  OrderLine as PrismaOrderLine,
} from '@prisma/client';

type OrderWithLines = PrismaOrder & { lines: PrismaOrderLine[] };

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async findByRazorpayOrderId(razorpayOrderId: string): Promise<Order | null> {
    const row = await this.prisma.order.findFirst({
      where: { razorpayOrderId, deletedAt: null },
      include: { lines: true },
    });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Order + OrderLines are written atomically. On first save (order not
   * yet in the DB) lines are created alongside the order — CheckoutUseCase
   * always creates a brand-new Order with its full line set in one call,
   * so `createMany` for the lines is correct here (never a partial/merge
   * update of existing lines in this slice — the webhook path only
   * mutates order-level fields via `update`, never touches order_lines).
   */
  async save(order: Order): Promise<void> {
    const props = order.snapshot;

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({ where: { id: props.id } });

      if (!existing) {
        await tx.order.create({
          data: {
            id: props.id,
            userId: props.userId,
            shippingAddressId: props.shippingAddressId,
            billingAddressId: props.billingAddressId,
            status: props.status,
            subtotalMinor: props.subtotalMinor,
            taxMinor: props.taxMinor,
            shippingMinor: props.shippingMinor,
            totalMinor: props.totalMinor,
            razorpayOrderId: props.razorpayOrderId,
            razorpayPaymentId: props.razorpayPaymentId,
            paidAt: props.paidAt,
            version: props.version,
            lines: {
              createMany: {
                data: props.lines.map((line) => ({
                  id: line.id,
                  productVariantId: line.productVariantId,
                  vendorId: line.vendorId,
                  quantity: line.quantity,
                  unitPriceMinor: line.unitPriceMinor,
                  taxMinor: line.taxMinor,
                  commissionBpsSnapshot: line.commissionBpsSnapshot,
                  status: line.status,
                })),
              },
            },
          },
        });
        return;
      }

      await tx.order.update({
        where: { id: props.id },
        data: {
          status: props.status,
          razorpayOrderId: props.razorpayOrderId,
          razorpayPaymentId: props.razorpayPaymentId,
          paidAt: props.paidAt,
          version: { increment: 1 },
        },
      });
    });
  }

  private toDomain(row: OrderWithLines): Order {
    const props: OrderProps = {
      id: row.id,
      userId: row.userId,
      shippingAddressId: row.shippingAddressId,
      billingAddressId: row.billingAddressId,
      status: row.status,
      subtotalMinor: row.subtotalMinor,
      taxMinor: row.taxMinor,
      shippingMinor: row.shippingMinor,
      totalMinor: row.totalMinor,
      razorpayOrderId: row.razorpayOrderId,
      razorpayPaymentId: row.razorpayPaymentId,
      paidAt: row.paidAt,
      lines: row.lines.map((line) => ({
        id: line.id,
        productVariantId: line.productVariantId,
        vendorId: line.vendorId,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        taxMinor: line.taxMinor,
        commissionBpsSnapshot: line.commissionBpsSnapshot,
        status: line.status,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Order.reconstitute(props);
  }
}
