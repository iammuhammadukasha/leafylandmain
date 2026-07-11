import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Cart, type CartProps } from '../../domain/entities/cart.entity';
import {
  CART_REPOSITORY,
  type CartRepository,
} from '../../domain/repositories/cart.repository';
import {
  PRODUCT_LOOKUP_REPOSITORY,
  type ProductLookupRepository,
} from '../../domain/repositories/product-lookup.repository';
import { ProductVariantNotAvailableError } from '../../domain/errors/order.errors';

export interface AddCartLineInput {
  userId: string;
  productVariantId: string;
  quantity: number;
}

export type AddCartLineResult = CartProps;

/**
 * POST /api/v1/orders/cart/lines (Auth, FR-ORD-001). Must call into
 * Product's read port (ProductLookupRepository, the Orders-owned
 * cross-context port — see its doc comment) to confirm the variant exists
 * and belongs to an `active` product before adding it — rejecting
 * otherwise with ProductVariantNotAvailableError. Does NOT check stock
 * here (add-to-cart is not the stock-authoritative moment per FR-ORD-001 —
 * "Cart validates stock and price at checkout time, not just at
 * add-time" — stock is re-validated at quote/checkout).
 */
@Injectable()
export class AddCartLineUseCase {
  constructor(
    @Inject(CART_REPOSITORY) private readonly carts: CartRepository,
    @Inject(PRODUCT_LOOKUP_REPOSITORY)
    private readonly productLookup: ProductLookupRepository,
  ) {}

  async execute(input: AddCartLineInput): Promise<AddCartLineResult> {
    const variant = await this.productLookup.findVariantById(
      input.productVariantId,
    );
    if (!variant || variant.productStatus !== 'active') {
      throw new ProductVariantNotAvailableError();
    }

    const now = new Date();
    let cart = await this.carts.findActiveByUserId(input.userId);
    if (!cart) {
      cart = Cart.create({ id: randomUUID(), userId: input.userId, now });
    }

    cart.addOrIncrementLine({
      lineId: randomUUID(),
      productVariantId: input.productVariantId,
      quantity: input.quantity,
      now,
    });

    await this.carts.save(cart);
    return cart.snapshot;
  }
}
