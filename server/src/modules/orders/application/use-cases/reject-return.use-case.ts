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
  OrderLineNotOwnedError,
  ReturnForbiddenError,
  ReturnNotFoundError,
  ReturnNotRequestedError,
} from '../../domain/errors/order.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface RejectReturnInput {
  actorUserId: string;
  returnId: string;
  reason: string;
  ipAddress: string | null;
}

export type RejectReturnResult = ReturnProps;

/**
 * POST /api/v1/orders/returns/:id/reject — FR-ORD-005. Same authorization
 * shape as ApproveReturnUseCase (owning vendor OR admin — see that class's
 * doc comment for the full ownership/admin-check rationale, duplicated here
 * rather than factored into a shared helper for the same
 * no-speculative-abstraction reason DeliverShipmentUseCase gives for not
 * sharing ship/deliver's ownership check: the two use cases' post-check
 * logic diverges enough — approve triggers a refund + order-line mutation,
 * reject does neither — that a shared "resolveAuthorizedReturn" helper
 * would need its own parameterization anyway).
 *
 * Transitions `Return.status` to `rejected`. Deliberately does NOT touch
 * `order_lines.status` — it stays `fulfilled` (FR-ORD-005: "a rejected
 * return isn't a refund"). No PaymentGatewayPort call at all.
 */
@Injectable()
export class RejectReturnUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(RETURN_REPOSITORY) private readonly returns: ReturnRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(ORDERS_USER_ROLES_REPOSITORY)
    private readonly userRoles: OrdersUserRolesRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: RejectReturnInput): Promise<RejectReturnResult> {
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
    returnEntity.reject(input.actorUserId, now);
    await this.returns.save(returnEntity);

    await this.auditLogger.record({
      actorUserId: input.actorUserId,
      action: 'order.return_rejected',
      targetType: 'return',
      targetId: returnEntity.id,
      diff: { orderLineId: line.id, reason: input.reason },
      ipAddress: input.ipAddress,
    });

    return returnEntity.snapshot;
  }
}
