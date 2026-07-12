import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Shipment,
  type ShipmentProps,
} from '../../domain/entities/shipment.entity';
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
  OrderNotPaidError,
} from '../../domain/errors/order.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface ShipOrderLineInput {
  userId: string;
  orderLineId: string;
  carrier: string;
  trackingNumber: string;
  ipAddress: string | null;
}

export type ShipOrderLineResult = ShipmentProps;

/**
 * POST /api/v1/vendors/me/orders/:orderLineId/ship — FR-ORD-006. THE
 * security-critical rule this endpoint exists to prove (same "no-leak
 * vendor-scoping" precedent as FR-ID-006's AC): a caller may only ship an
 * order line that belongs to THEIR vendor, verified by a DB-backed
 * ownership check — never by trusting a client-supplied vendorId.
 *
 * Ownership chain: orderLineId -> Order aggregate (OrderRepository,
 * findByOrderLineId) -> the specific line's vendorId -> compare against
 * the caller's own vendor id (OrdersVendorLookupRepository.
 * findByOwnerUserId(userId)). A line belonging to a different vendor
 * yields OrderLineForbiddenError (403), collapsed to the same shape
 * whether the line doesn't exist for ANY vendor or exists for a DIFFERENT
 * one — see error class doc comments for the exact split (404 for
 * genuinely unknown ids, 403 for "exists but not yours", matching how
 * GetOrderUseCase already treats Order-level ownership, not the
 * Review-style single-error collapse, because this is an authenticated
 * vendor operational surface, not a public-facing anti-enumeration
 * concern).
 *
 * BUSINESS RULE (ORDER_NOT_PAID): only a `paid` order's lines are
 * shippable — a `pending_payment` order hasn't been paid for yet
 * (FR-ORD-002's "no pending payment forever" note), so nothing should ship
 * against it. Mapped to 422 BUSINESS_RULE_VIOLATION / ORDER_NOT_PAID.
 *
 * GROUPING: creates or updates ONE Shipment per (orderId, vendorId) pair —
 * see Shipment entity's doc comment for the full grouping rationale. This
 * means shipping ANY ONE line for a vendor on a given order marks that
 * vendor's ENTIRE shipment (all their lines on that order) as shipped,
 * which is the intended real-world behavior (one parcel, one tracking
 * number, covers everything the vendor packed for that order).
 */
@Injectable()
export class ShipOrderLineUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(SHIPMENT_REPOSITORY)
    private readonly shipments: ShipmentRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: ShipOrderLineInput): Promise<ShipOrderLineResult> {
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

    if (order.status !== 'paid') {
      throw new OrderNotPaidError();
    }

    const now = new Date();
    const existing = await this.shipments.findByOrderIdAndVendorId(
      order.id,
      vendor.id,
    );

    const shipment = existing
      ? existing
      : Shipment.createShipped({
          id: randomUUID(),
          orderId: order.id,
          vendorId: vendor.id,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
          now,
        });

    if (existing) {
      existing.reship(input.carrier, input.trackingNumber, now);
    }

    await this.shipments.save(shipment);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'order.shipped',
      targetType: 'shipment',
      targetId: shipment.id,
      diff: {
        orderId: order.id,
        vendorId: vendor.id,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
      },
      ipAddress: input.ipAddress,
    });

    return shipment.snapshot;
  }
}
