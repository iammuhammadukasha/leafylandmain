import { Inject, Injectable } from '@nestjs/common';
import {
  CART_REPOSITORY,
  type CartRepository,
} from '../../domain/repositories/cart.repository';
import { CartEmptyError } from '../../domain/errors/order.errors';
import {
  CartPricingService,
  type CartQuote,
} from '../services/cart-pricing.service';

export interface CheckoutQuoteInput {
  userId: string;
}

export type CheckoutQuoteResult = CartQuote;

/**
 * POST /api/v1/orders/checkout/quote (Auth, FR-ORD-002/FR-ORD-007
 * scope-reduced). Re-validates price/stock for every cart line against
 * Product's current data and computes the subtotal/tax/shipping
 * breakdown. Does NOT create an order — read-only, calls
 * CartPricingService.quote() (see that file for the shared re-pricing
 * logic also used by CheckoutUseCase).
 */
@Injectable()
export class CheckoutQuoteUseCase {
  constructor(
    @Inject(CART_REPOSITORY) private readonly carts: CartRepository,
    private readonly pricing: CartPricingService,
  ) {}

  async execute(input: CheckoutQuoteInput): Promise<CheckoutQuoteResult> {
    const cart = await this.carts.findActiveByUserId(input.userId);
    if (!cart) {
      throw new CartEmptyError();
    }
    return this.pricing.quote(cart);
  }
}
