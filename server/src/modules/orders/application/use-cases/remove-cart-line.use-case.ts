import { Inject, Injectable } from '@nestjs/common';
import { type CartProps } from '../../domain/entities/cart.entity';
import {
  CART_REPOSITORY,
  type CartRepository,
} from '../../domain/repositories/cart.repository';
import { CartLineNotFoundError } from '../../domain/errors/order.errors';

export interface RemoveCartLineInput {
  userId: string;
  productVariantId: string;
}

export type RemoveCartLineResult = CartProps;

/** DELETE /api/v1/orders/cart/lines/:variantId (Auth, FR-ORD-001). */
@Injectable()
export class RemoveCartLineUseCase {
  constructor(
    @Inject(CART_REPOSITORY) private readonly carts: CartRepository,
  ) {}

  async execute(input: RemoveCartLineInput): Promise<RemoveCartLineResult> {
    const cart = await this.carts.findActiveByUserId(input.userId);
    if (!cart) {
      throw new CartLineNotFoundError();
    }

    const removed = cart.removeLine(input.productVariantId, new Date());
    if (!removed) {
      throw new CartLineNotFoundError();
    }

    await this.carts.save(cart);
    return cart.snapshot;
  }
}
