/**
 * Domain-owned port for the narrow product/variant facts Orders' use cases
 * need (variant price/stock/SKU, owning product's status/vendor/category
 * tax rate). `products`/`product_variants`/`categories` are Product-context
 * tables (Volume 04 §5), but per the Architecture §3 cross-context rule ("a
 * module never queries another module's database tables directly...
 * Prisma schemas are organized so each module's models are only injected
 * into that module's repositories"), Orders gets its OWN thin, read-mostly
 * repository over those tables for the queries it needs — same pattern as
 * Product's own `VendorLookupRepository` reading Vendor's `vendors` table.
 *
 * DESIGN DECISION: this port is read-only for everything EXCEPT
 * `decrementStock`, which is a narrow, single-purpose write used ONLY by
 * the verified-webhook payment handler (BR-ORD-01 path) to decrement
 * `product_variants.stock_quantity` after a payment is confirmed. The task
 * brief explicitly allows "a narrow write method to the existing
 * VendorLookupRepository-style port... but do NOT reach directly into
 * Product's Prisma models from Orders' repository; go through a port" —
 * this is that port. It does not reach into Product's domain entities or
 * use cases, and it does not touch any other Product-owned column.
 */
export interface ProductVariantSummary {
  id: string;
  productId: string;
  sku: string;
  priceMinor: bigint;
  stockQuantity: number;
  /** Owning product's facts, denormalized onto this summary so callers
   * don't need a second round trip — mirrors how order_lines.vendorId is
   * an intentional denormalization per Volume 04 §7. */
  productStatus: 'draft' | 'active' | 'delisted';
  vendorId: string;
  categoryTaxRateBps: number;
}

export interface ProductLookupRepository {
  findVariantById(id: string): Promise<ProductVariantSummary | null>;
  /** BR-ORD-01 path only — decrements stock by `quantity` for the given
   * variant. Returns the row's new stock_quantity. Callers must have
   * already confirmed sufficient stock (checkout/quote re-validation);
   * this method does not itself enforce a floor-at-zero business rule —
   * that judgment call belongs to the calling use case, not this thin
   * infrastructure-facing port. */
  decrementStock(variantId: string, quantity: number): Promise<void>;
}

export const PRODUCT_LOOKUP_REPOSITORY = Symbol('PRODUCT_LOOKUP_REPOSITORY');
