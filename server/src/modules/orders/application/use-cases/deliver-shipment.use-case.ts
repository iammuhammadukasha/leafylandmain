import { Inject, Injectable } from '@nestjs/common';
import type { ShipmentProps } from '../../domain/entities/shipment.entity';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository';
import {
  SHIPMENT_REPOSITORY,
  type ShipmentRepository,
} from '../../domain/repositories/shipment.repository';
import {
  VENDOR_LOOKUP_REPOSITORY,
  type VendorLookupRepository,
} from '../../domain/repositories/vendor-lookup.repository';
import {
  OrderForbiddenError,
  OrderLineForbiddenError,
  OrderLineNotFoundError,
  ShipmentNotShippedError,
} from '../../domain/errors/order.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface DeliverShipmentInput {
  userId: string;
  orderLineId: string;
  ipAddress: string | null;
}

export type DeliverShipmentResult = ShipmentProps;

/**
 * POST /api/v1/vendors/me/orders/:orderLineId/deliver — FR-ORD-006. Same
 * ownership-check pattern as ShipOrderLineUseCase (see its doc comment for
 * the full rationale) — repeated here rather than factored into a shared
 * helper because each use case's error handling around the check differs
 * subtly enough (ship also needs the resolved vendor id for the
 * paid-check; deliver needs it for the shipment lookup) that a shared
 * helper would need its own parameterization anyway; Constitution §11.6
 * (no speculative abstraction) favors the small duplication here over a
 * premature shared "resolveOwnedOrderLine" utility for just two callers.
 *
 * THE STATE-MACHINE ORDERING RULE this endpoint exists to prove
 * (ShipmentNotShippedError, 422 SHIPMENT_NOT_SHIPPED): deliver is only
 * callable when a Shipment already exists for this (orderId, vendorId)
 * pair AND that shipment is currently `shipped` — never on a line that was
 * never shipped (no Shipment row at all) and never twice (already
 * `delivered`). This is deliberately a hard reject, not a silent no-op,
 * so a vendor's fulfillment UI gets a clear signal it called the endpoints
 * out of order.
 *
 * ON SUCCESS: transitions the Shipment to `delivered` AND, in the same
 * use case (single Order.save() covers all affected lines), every
 * `pending` order_line belonging to this vendor on this order to
 * `fulfilled` (Order.fulfillLinesForVendor — see that method's doc
 * comment for why ALL of the vendor's lines on this order move together,
 * not just the one named in the URL: one shipment covers all of them).
 */
@Injectable()
export class DeliverShipmentUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(SHIPMENT_REPOSITORY)
    private readonly shipments: ShipmentRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: DeliverShipmentInput): Promise<DeliverShipmentResult> {
    const vendor = await this.vendorLookup.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new OrderForbiddenError(
        'You must have a vendor account to fulfill orders.',
      );
    }

    const order = await this.orders.findByOrderLineId(input.orderLineId);
    if (!order) {
      throw new OrderLineNotFoundError();
    }

    const line = order.lines.find((l) => l.id === input.orderLineId);
    if (!line) {
      throw new OrderLineNotFoundError();
    }
    if (line.vendorId !== vendor.id) {
      throw new OrderLineForbiddenError();
    }

    const shipment = await this.shipments.findByOrderIdAndVendorId(
      order.id,
      vendor.id,
    );
    if (!shipment || shipment.status !== 'shipped') {
      throw new ShipmentNotShippedError();
    }

    const now = new Date();
    shipment.markDelivered(now);
    await this.shipments.save(shipment);

    order.fulfillLinesForVendor(vendor.id, now);
    await this.orders.save(order);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'order.delivered',
      targetType: 'shipment',
      targetId: shipment.id,
      diff: { orderId: order.id, vendorId: vendor.id },
      ipAddress: input.ipAddress,
    });

    return shipment.snapshot;
  }
}
