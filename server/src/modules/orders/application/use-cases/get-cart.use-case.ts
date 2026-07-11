import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Cart, type CartProps } from '../../domain/entities/cart.entity';
import {
  CART_REPOSITORY,
  type CartRepository,
} from '../../domain/repositories/cart.repository';

export interface GetCartInput {
  userId: string;
}

export type GetCartResult = CartProps;

/**
 * GET /api/v1/orders/cart (Auth-only for this slice, FR-ORD-001). Gets the
 * caller's active cart, creating an empty one lazily on first access —
 * matches Volume 04 §6 ("Persistent cart per user (survives session)")
 * without needing a separate "create cart" endpoint that isn't in the API
 * spec (§6.1 lists no POST /cart).
 */
@Injectable()
export class GetCartUseCase {
  constructor(
    @Inject(CART_REPOSITORY) private readonly carts: CartRepository,
  ) {}

  async execute(input: GetCartInput): Promise<GetCartResult> {
    const existing = await this.carts.findActiveByUserId(input.userId);
    if (existing) {
      return existing.snapshot;
    }

    const cart = Cart.create({
      id: randomUUID(),
      userId: input.userId,
      now: new Date(),
    });
    await this.carts.save(cart);
    return cart.snapshot;
  }
}
