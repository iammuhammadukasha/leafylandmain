import { Inject, Injectable } from '@nestjs/common';
import { type OrderProps } from '../../domain/entities/order.entity';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository';
import {
  OrderForbiddenError,
  OrderNotFoundError,
} from '../../domain/errors/order.errors';

export interface GetOrderInput {
  userId: string;
  orderId: string;
}

export type GetOrderResult = OrderProps;

/**
 * GET /api/v1/orders/:orderId (Auth, owner-only, FR-ORD-002). Follows the
 * same no-leak pattern as Vendor's `/me` scoping: a non-owner gets
 * OrderForbiddenError (mapped to 403), not silently a different order's
 * data — and a nonexistent id gets OrderNotFoundError (404). The task
 * brief allows "403/404, whichever matches the established pattern" — see
 * order-error.mapper.ts for which one is actually returned (403, since we
 * distinguish "doesn't exist" from "exists but not yours" at this layer;
 * admin override is out of scope for this slice, API Spec §6.2 lists
 * "Auth (owner) or admin" but no admin role/claim check exists yet).
 */
@Injectable()
export class GetOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
  ) {}

  async execute(input: GetOrderInput): Promise<GetOrderResult> {
    const order = await this.orders.findById(input.orderId);
    if (!order) {
      throw new OrderNotFoundError();
    }
    if (order.userId !== input.userId) {
      throw new OrderForbiddenError();
    }
    return order.snapshot;
  }
}
