import type { Review } from '../entities/review.entity';

export interface ReviewListPage {
  items: Review[];
  nextCursor: string | null;
}

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface ReviewRepository {
  findById(id: string): Promise<Review | null>;
  /** UNIQUE(order_line_id) — used by SubmitReviewUseCase to reject a
   * second review attempt on the same order line before hitting the DB
   * constraint (409 CONFLICT, same "check then let the DB be the final
   * guard" precedent as SkuTakenError's pre-check in
   * CreateProductVariantUseCase). */
  findByOrderLineId(orderLineId: string): Promise<Review | null>;
  /** Cursor-paginated reviews for a product (public listing, FR-PRD-004),
   * ordered by createdAt desc, id desc for stable pagination — same
   * pattern as ProductRepository.findActivePaginated. */
  findByProductIdPaginated(params: {
    productId: string;
    cursor: string | null;
    limit: number;
  }): Promise<ReviewListPage>;
  save(review: Review): Promise<void>;
}

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');
