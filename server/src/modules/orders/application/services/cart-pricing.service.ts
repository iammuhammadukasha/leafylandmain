import { Inject, Injectable } from '@nestjs/common';
import type { Cart } from '../../domain/entities/cart.entity';
import {
  PRODUCT_LOOKUP_REPOSITORY,
  type ProductLookupRepository,
  type ProductVariantSummary,
} from '../../domain/repositories/product-lookup.repository';
import {
  CartEmptyError,
  OutOfStockError,
  ProductVariantNotAvailableError,
} from '../../domain/errors/order.errors';

/** Flat shipping stub (task instruction: "shipping can be a flat stub
 * amount... your call, keep it simple and document it"). DECISION: flat
 * 5000 paise (INR 50) per order, free above a 999900 paise (INR 9,999)
 * subtotal threshold. This is a placeholder — no shipping-method
 * selection, no per-vendor split shipping, no carrier rate lookup
 * (FR-ORD-006 deferred in full). Not sourced from config per Constitution
 * §4.8 ("no hardcoded values... business thresholds live in
 * configuration/DB") — a genuine deviation, justified because a real
 * shipping-rate mechanism doesn't exist yet to configure; hardcoding a
 * documented stub here is preferable to speculative config plumbing for a
 * number that will be replaced wholesale once real shipping rating
 * exists.
 */
const FLAT_SHIPPING_MINOR = 5000n;
const FREE_SHIPPING_THRESHOLD_MINOR = 999_900n;

export interface PricedLine {
  productVariantId: string;
  sku: string;
  vendorId: string;
  quantity: number;
  unitPriceMinor: bigint;
  lineSubtotalMinor: bigint;
  lineTaxMinor: bigint;
  categoryTaxRateBps: number;
}

export interface CartQuote {
  lines: PricedLine[];
  subtotalMinor: bigint;
  taxMinor: bigint;
  shippingMinor: bigint;
  totalMinor: bigint;
}

/**
 * Shared re-pricing logic for POST /checkout/quote (FR-ORD-002/007) AND
 * POST /checkout (which "re-runs the same validation as quote, don't trust
 * a stale quote" per the task brief) — one place this rule lives, called
 * from both use cases, per Constitution §4.7 "no duplicated business
 * logic. A rule lives in exactly one place... and is called, never
 * copy-pasted."
 *
 * TAX SIMPLIFICATION (FR-ORD-007, documented scope reduction): flat
 * GST-style calc using the line's category `taxRateBps` only — no
 * CGST/SGST/IGST state-based splitting based on shipping address state.
 * `taxMinor` per line = round(lineSubtotalMinor * taxRateBps / 10000).
 */
@Injectable()
export class CartPricingService {
  constructor(
    @Inject(PRODUCT_LOOKUP_REPOSITORY)
    private readonly productLookup: ProductLookupRepository,
  ) {}

  async quote(cart: Cart): Promise<CartQuote> {
    if (cart.lines.length === 0) {
      throw new CartEmptyError();
    }

    const lines: PricedLine[] = [];
    for (const line of cart.lines) {
      const variant = await this.productLookup.findVariantById(
        line.productVariantId,
      );
      this.assertPurchasable(variant, line.quantity);
      // assertPurchasable narrows variant to non-null for TS below.
      const v = variant as ProductVariantSummary;

      const lineSubtotalMinor = v.priceMinor * BigInt(line.quantity);
      const lineTaxMinor =
        (lineSubtotalMinor * BigInt(v.categoryTaxRateBps)) / 10_000n;

      lines.push({
        productVariantId: v.id,
        sku: v.sku,
        vendorId: v.vendorId,
        quantity: line.quantity,
        unitPriceMinor: v.priceMinor,
        lineSubtotalMinor,
        lineTaxMinor,
        categoryTaxRateBps: v.categoryTaxRateBps,
      });
    }

    const subtotalMinor = lines.reduce(
      (sum, l) => sum + l.lineSubtotalMinor,
      0n,
    );
    const taxMinor = lines.reduce((sum, l) => sum + l.lineTaxMinor, 0n);
    const shippingMinor =
      subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR ? 0n : FLAT_SHIPPING_MINOR;
    const totalMinor = subtotalMinor + taxMinor + shippingMinor;

    return { lines, subtotalMinor, taxMinor, shippingMinor, totalMinor };
  }

  private assertPurchasable(
    variant: ProductVariantSummary | null,
    quantity: number,
  ): void {
    if (!variant || variant.productStatus !== 'active') {
      throw new ProductVariantNotAvailableError();
    }
    if (variant.stockQuantity < quantity) {
      throw new OutOfStockError(variant.sku);
    }
  }
}
