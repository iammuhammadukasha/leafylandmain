import type { Product } from '../entities/product.entity';

export interface ProductListPage {
  items: Product[];
  nextCursor: string | null;
}

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findByVendorId(vendorId: string): Promise<Product[]>;
  /** Cursor-paginated, `active`-status only (public catalog listing,
   * FR-PRD-005 scope-reduced — no search/facets, see Product module's
   * final report deferred list). Cursor is the product id (opaque to the
   * caller), ordered by createdAt desc, id desc for stability. */
  findActivePaginated(params: {
    cursor: string | null;
    limit: number;
  }): Promise<ProductListPage>;
  save(product: Product): Promise<void>;
}

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
