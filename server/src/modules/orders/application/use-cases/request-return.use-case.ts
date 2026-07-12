import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Return, type ReturnProps } from '../../domain/entities/return.entity';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository';
import {
  SHIPMENT_REPOSITORY,
  type ShipmentRepository,
} from '../../domain/repositories/shipment.repository';
import {
  RETURN_REPOSITORY,
  type ReturnRepository,
} from '../../domain/repositories/return.repository';
import {
  OrderLineNotOwnedError,
  ReturnAlreadyExistsError,
  ReturnWindowExpiredError,
} from '../../domain/errors/order.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface RequestReturnInput {
  userId: string;
  orderLineId: string;
  reason: string;
  ipAddress: string | null;
}

export type RequestReturnResult = ReturnProps;

/** FR-ORD-005's documented simplification (see schema.prisma's Return model
 * doc comment): a single fixed platform-wide return window, not a
 * per-category one. 7 days from delivery. */
export const RETURN_WINDOW_DAYS = 7;

/**
 * POST /api/v1/orders/lines/:orderLineId/return — FR-ORD-005. Buyer-only:
 * the caller must own the order the line belongs to.
 *
 * OWNERSHIP: orderLineId -> Order aggregate (OrderRepository.
 * findByOrderLineId, same lookup Ship/DeliverShipmentUseCase use) -> compare
 * Order.userId against the caller. A line that doesn't exist at all AND a
 * line that exists but belongs to a different buyer both collapse to the
 * SAME OrderLineNotOwnedError (mapped to 404 by the interface layer) — this
 * is the anti-enumeration no-leak pattern (AddressForbiddenError /
 * CartLineNotFoundError precedent), not the vendor-fulfillment 403-split
 * pattern, because this is a buyer-facing endpoint where leaking "an order
 * line with this id exists for someone else" has no legitimate operational
 * use the way it does for vendor fulfillment's authenticated back-office
 * surface.
 *
 * ELIGIBILITY (BUSINESS_RULE_VIOLATION / RETURN_WINDOW_EXPIRED, API Spec
 * §6.4): a return only makes sense for a line that was actually delivered
 * — i.e. `order_lines.status === 'fulfilled'` (Volume 04 §6's enum; a
 * `pending` line was never fulfilled, so there's nothing to return). A line
 * already `returned`/`refunded` also fails this check implicitly via the
 * one-return-per-line uniqueness check below, not via this status gate
 * (status stays `fulfilled` until refund succeeds — see Order entity's
 * refundLine doc comment — so the SECOND request on the same line reaches
 * the uniqueness check, not a stale status check).
 *
 * WINDOW: 7 days (RETURN_WINDOW_DAYS) from the order line's delivery
 * timestamp. order_lines has no `delivered_at` column of its own (Volume 04
 * §6's ERD doesn't define one), so this reads the covering Shipment's
 * `updatedAt` at the time it is `delivered` (Shipment.markDelivered sets
 * `updatedAt = now`, and DeliverShipmentUseCase calls that in the same
 * transaction as Order.fulfillLinesForVendor — the two timestamps are for
 * all practical purposes the same instant) as the delivery fact. Both "not
 * fulfilled yet" and "window expired" map to the SAME
 * ReturnWindowExpiredError / RETURN_WINDOW_EXPIRED code (see that error
 * class's doc comment for why: the API spec defines only one code for this
 * endpoint's business-rule rejection).
 *
 * UNIQUENESS: one return per order line (Return.orderLineId is DB-unique,
 * same precedent as Review.orderLineId — a buyer can only ever request ONE
 * return against a given line, regardless of whether the previous attempt
 * was rejected; see ReturnAlreadyExistsError's doc comment for the "no
 * retry after rejection" decision).
 */
@Injectable()
export class RequestReturnUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(SHIPMENT_REPOSITORY)
    private readonly shipments: ShipmentRepository,
    @Inject(RETURN_REPOSITORY) private readonly returns: ReturnRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: RequestReturnInput): Promise<RequestReturnResult> {
    const order = await this.orders.findByOrderLineId(input.orderLineId);
    if (!order || order.userId !== input.userId) {
      throw new OrderLineNotOwnedError();
    }

    const line = order.lines.find((l) => l.id === input.orderLineId);
    if (!line) {
      throw new OrderLineNotOwnedError();
    }

    if (line.status !== 'fulfilled') {
      throw new ReturnWindowExpiredError(
        'This order line has not been delivered yet and cannot be returned.',
      );
    }

    const existing = await this.returns.findByOrderLineId(input.orderLineId);
    if (existing) {
      throw new ReturnAlreadyExistsError();
    }

    const shipment = await this.shipments.findByOrderIdAndVendorId(
      order.id,
      line.vendorId,
    );
    const deliveredAt =
      shipment?.status === 'delivered' ? shipment.snapshot.updatedAt : null;
    if (!deliveredAt) {
      // Defensive: a `fulfilled` line should always have a `delivered`
      // shipment behind it (DeliverShipmentUseCase is the only path to
      // `fulfilled`), but if that invariant is ever violated, fail closed.
      throw new ReturnWindowExpiredError(
        'This order line has not been delivered yet and cannot be returned.',
      );
    }

    const now = new Date();
    const windowEnd = new Date(
      deliveredAt.getTime() + RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    if (now > windowEnd) {
      throw new ReturnWindowExpiredError(
        `The ${RETURN_WINDOW_DAYS}-day return window for this order line has expired.`,
      );
    }

    const returnEntity = Return.request({
      id: randomUUID(),
      orderLineId: input.orderLineId,
      reason: input.reason,
      now,
    });
    await this.returns.save(returnEntity);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'order.return_requested',
      targetType: 'return',
      targetId: returnEntity.id,
      diff: { orderLineId: input.orderLineId, reason: input.reason },
      ipAddress: input.ipAddress,
    });

    return returnEntity.snapshot;
  }
}
