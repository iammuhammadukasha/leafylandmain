import type { ProductVariant } from '../entities/product-variant.entity';

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface ProductVariantRepository {
  findById(id: string): Promise<ProductVariant | null>;
  findByProductId(productId: string): Promise<ProductVariant[]>;
  /** VR-PRD — SKU uniqueness check, platform-wide (not scoped to a
   * product/vendor). */
  findBySku(sku: string): Promise<ProductVariant | null>;
  save(variant: ProductVariant): Promise<void>;
}

export const PRODUCT_VARIANT_REPOSITORY = Symbol('PRODUCT_VARIANT_REPOSITORY');
