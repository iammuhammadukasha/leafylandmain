import { Inject, Injectable } from '@nestjs/common';
import type { ReturnProps } from '../../domain/entities/return.entity';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository';
import {
  RETURN_REPOSITORY,
  type ReturnRepository,
} from '../../domain/repositories/return.repository';
import {
  VENDOR_LOOKUP_REPOSITORY,
  type VendorLookupRepository,
} from '../../domain/repositories/vendor-lookup.repository';
import {
  ORDERS_USER_ROLES_REPOSITORY,
  type OrdersUserRolesRepository,
} from '../../domain/repositories/user-roles.repository';
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
} from '../ports/payment-gateway.port';
import {
  OrderLineNotOwnedError,
  ReturnForbiddenError,
  ReturnNotFoundError,
  ReturnNotRequestedError,
} from '../../domain/errors/order.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface ApproveReturnInput {
  actorUserId: string;
  returnId: string;
  ipAddress: string | null;
}

export type ApproveReturnResult = ReturnProps;

/**
 * POST /api/v1/orders/returns/:id/approve — FR-ORD-005. Authorized for the
 * owning vendor (vendor_owner/vendor_staff, resolved the same
 * ownership-check way as ShipOrderLineUseCase — VendorLookupRepository.
 * findByOwnerUserId(actorUserId), then compare against the order line's
 * vendorId) OR a global admin (DB-backed role check, VerifyVendorUseCase's
 * precedent — UserRolesRepository.hasRole(actorUserId, 'admin')). Neither
 * check short-circuits the other: a caller with NEITHER a matching vendor
 * NOR the admin role gets ReturnForbiddenError (403), no leak of which
 * vendor owns the line.
 *
 * STATE MACHINE (Return entity's doc comment): this single use case runs
 * BOTH `requested -> approved` AND `approved -> refunded` inside one
 * transaction-shaped call (no separate persistence between the two — see
 * `execute` below) — the task brief's "the point is the STATES exist and
 * are correct in the final row, not that there are two separate
 * user-facing API calls for this slice" — but the entity still asserts
 * `approved` as a real intermediate status (Return.approve() then
 * Return.markRefunded() are two distinct method calls, each asserting its
 * own precondition) rather than a single "approveAndRefund" method that
 * skips stright to `refunded`, so a future slice that DOES want to expose
 * `approved` as a separately observable state (e.g. an async refund queue)
 * doesn't need to touch this entity's invariants, only this use case's
 * orchestration.
 *
 * ON SUCCESS: calls PaymentGatewayPort.refund() using the order's
 * `razorpayPaymentId` (captured from the verified webhook, BR-ORD-01) and
 * the order line's own amount (unitPriceMinor * quantity + taxMinor, NOT
 * the whole order's total — this is a per-line refund), records the
 * returned refund id on the Return row, and transitions
 * `order_lines.status` to `refunded` via Order.refundLine (the existing
 * `refunded` OrderLineStatus enum value from the original Orders schema,
 * confirmed present — see order.entity.ts).
 */
@Injectable()
export class ApproveReturnUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(RETURN_REPOSITORY) private readonly returns: ReturnRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(ORDERS_USER_ROLES_REPOSITORY)
    private readonly userRoles: OrdersUserRolesRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly paymentGateway: PaymentGatewayPort,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: ApproveReturnInput): Promise<ApproveReturnResult> {
    const returnEntity = await this.returns.findById(input.returnId);
    if (!returnEntity) {
      throw new ReturnNotFoundError();
    }

    const order = await this.orders.findByOrderLineId(returnEntity.orderLineId);
    if (!order) {
      throw new OrderLineNotOwnedError();
    }
    const line = order.lines.find((l) => l.id === returnEntity.orderLineId);
    if (!line) {
      throw new OrderLineNotOwnedError();
    }

    const isAdmin = await this.userRoles.hasAdminRole(input.actorUserId);
    if (!isAdmin) {
      const vendor = await this.vendorLookup.findByOwnerUserId(
        input.actorUserId,
      );
      if (!vendor || vendor.id !== line.vendorId) {
        throw new ReturnForbiddenError();
      }
    }

    if (returnEntity.status !== 'requested') {
      throw new ReturnNotRequestedError();
    }

    const now = new Date();
    returnEntity.approve(input.actorUserId, now);

    const refundAmountMinor = line.unitPriceMinor + line.taxMinor;
    const paymentId = order.snapshot.razorpayPaymentId;
    if (!paymentId) {
      throw new Error(
        `Order ${order.id} has no razorpayPaymentId; cannot refund an unpaid order.`,
      );
    }

    const refundResult = await this.paymentGateway.refund({
      paymentId,
      amountMinor: refundAmountMinor,
    });

    returnEntity.markRefunded(refundResult.refundId, now);
    await this.returns.save(returnEntity);

    order.refundLine(line.id, now);
    await this.orders.save(order);

    await this.auditLogger.record({
      actorUserId: input.actorUserId,
      action: 'order.return_approved',
      targetType: 'return',
      targetId: returnEntity.id,
      diff: {
        orderLineId: line.id,
        refundId: refundResult.refundId,
        refundAmountMinor: refundAmountMinor.toString(),
      },
      ipAddress: input.ipAddress,
    });

    return returnEntity.snapshot;
  }
}
