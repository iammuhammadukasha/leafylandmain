import { Inject, Injectable } from '@nestjs/common';
import { type CartProps } from '../../domain/entities/cart.entity';
import {
  CART_REPOSITORY,
  type CartRepository,
} from '../../domain/repositories/cart.repository';
import { CartLineNotFoundError } from '../../domain/errors/order.errors';

export interface UpdateCartLineInput {
  userId: string;
  productVariantId: string;
  quantity: number;
}

export type UpdateCartLineResult = CartProps;

/**
 * PATCH /api/v1/orders/cart/lines/:variantId (Auth, FR-ORD-001). Sets the
 * line's quantity to an exact value. 404 (CartLineNotFoundError) if the
 * caller has no active cart or the cart has no line for that variant —
 * scoped to the caller's own cart by construction (findActiveByUserId),
 * same "structural scoping, not a route guard" precedent used across the
 * other modules.
 */
@Injectable()
export class UpdateCartLineUseCase {
  constructor(
    @Inject(CART_REPOSITORY) private readonly carts: CartRepository,
  ) {}

  async execute(input: UpdateCartLineInput): Promise<UpdateCartLineResult> {
    const cart = await this.carts.findActiveByUserId(input.userId);
    if (!cart) {
      throw new CartLineNotFoundError();
    }

    const updated = cart.updateLineQuantity({
      productVariantId: input.productVariantId,
      quantity: input.quantity,
      now: new Date(),
    });
    if (!updated) {
      throw new CartLineNotFoundError();
    }

    await this.carts.save(cart);
    return cart.snapshot;
  }
}
