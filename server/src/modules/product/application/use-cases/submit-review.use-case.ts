import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Review, type ReviewProps } from '../../domain/entities/review.entity';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  PRODUCT_VARIANT_REPOSITORY,
  type ProductVariantRepository,
} from '../../domain/repositories/product-variant.repository';
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from '../../domain/repositories/review.repository';
import {
  ORDER_LINE_LOOKUP_REPOSITORY,
  type OrderLineLookupRepository,
} from '../../domain/repositories/order-line-lookup.repository';
import {
  ProductNotFoundError,
  ReviewAlreadyExistsError,
  ReviewNotEligibleError,
} from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface SubmitReviewInput {
  userId: string;
  productId: string;
  orderLineId: string;
  rating: number;
  body: string;
  ipAddress: string | null;
}

export type SubmitReviewResult = ReviewProps;

/**
 * POST /api/v1/catalog/products/:id/reviews — FR-PRD-004. THE security-
 * critical rule this whole module exists to prove (BRS §7 rule 4,
 * "verified buyer only"): a caller may only review a product using an
 * order line that (a) exists, (b) belongs to them, (c) is for a variant of
 * THIS product, and (d) belongs to an order that has actually been paid.
 * Any failure of (a)-(d) collapses to the single ReviewNotEligibleError —
 * see that error's doc comment for why the reasons are never distinguished
 * in the response.
 *
 * DOCUMENTED DEVIATION from API Spec §5.3's literal wording ("verifies
 * orderLineId belongs to caller and is fulfilled"): this slice gates on
 * the containing order's status being `paid`, not the order_line's status
 * being `fulfilled`. Orders' current scope (see orders/schema.prisma
 * header comments) only ever drives an order to `paid` — shipping/
 * delivery/fulfillment (FR-ORD-006) doesn't exist yet, so `order_lines`
 * never reaches `fulfilled` in this system. Gating on the literal spec
 * wording would make reviews permanently impossible for every order ever
 * placed. This is a deliberate, documented scope adaptation to be revisited
 * once FR-ORD-006 ships and "fulfilled" becomes a real, reachable state —
 * NOT a bug and NOT silent scope creep (Constitution §11.5: ambiguity
 * should be raised, not silently assumed — this doc comment IS that
 * disclosure, mirrored in the final report).
 *
 * Order-line facts are read via OrderLineLookupRepository — Product's own
 * narrow cross-context port over Orders' `order_lines`/`orders` tables
 * (Volume 04 §7's cross-context reference rule), never a direct join.
 * ProductVariantRepository (Product's own, existing port) resolves the
 * order line's productVariantId back to a productId, to confirm the line
 * is for THIS product and not some other product entirely.
 */
@Injectable()
export class SubmitReviewUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_VARIANT_REPOSITORY)
    private readonly variants: ProductVariantRepository,
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    @Inject(ORDER_LINE_LOOKUP_REPOSITORY)
    private readonly orderLineLookup: OrderLineLookupRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: SubmitReviewInput): Promise<SubmitReviewResult> {
    const product = await this.products.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError();
    }

    // UNIQUE(order_line_id) pre-check (409 CONFLICT) BEFORE the eligibility
    // check (422) — a caller who already reviewed a line should see
    // "already reviewed" rather than being told the line isn't eligible
    // (it demonstrably was, they used it once already).
    const existingReview = await this.reviews.findByOrderLineId(
      input.orderLineId,
    );
    if (existingReview) {
      throw new ReviewAlreadyExistsError();
    }

    await this.assertEligible(input.userId, input.productId, input.orderLineId);

    const now = new Date();
    const review = Review.create({
      id: randomUUID(),
      productId: input.productId,
      userId: input.userId,
      orderLineId: input.orderLineId,
      rating: input.rating,
      body: input.body,
      now,
    });

    await this.reviews.save(review);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'review.submitted',
      targetType: 'review',
      targetId: review.id,
      diff: { productId: input.productId, orderLineId: input.orderLineId },
      ipAddress: input.ipAddress,
    });

    return review.snapshot;
  }

  /** Every distinct failure path collapses to ReviewNotEligibleError — see
   * this use case's class doc comment for why (never leak WHICH check
   * failed: not-found, not-yours, unpaid, or wrong-product all look
   * identical from the outside). */
  private async assertEligible(
    userId: string,
    productId: string,
    orderLineId: string,
  ): Promise<void> {
    const line = await this.orderLineLookup.findById(orderLineId);
    if (!line) {
      throw new ReviewNotEligibleError();
    }
    if (line.orderUserId !== userId) {
      throw new ReviewNotEligibleError();
    }
    if (line.orderStatus !== 'paid') {
      throw new ReviewNotEligibleError();
    }

    const variant = await this.variants.findById(line.productVariantId);
    if (!variant || variant.snapshot.productId !== productId) {
      throw new ReviewNotEligibleError();
    }
  }
}
