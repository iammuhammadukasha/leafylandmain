import { Inject, Injectable } from '@nestjs/common';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  REVIEW_REPOSITORY,
  type ReviewRepository,
} from '../../domain/repositories/review.repository';
import type { ReviewProps } from '../../domain/entities/review.entity';
import { ProductNotFoundError } from '../../domain/errors/product.errors';

export interface GetProductReviewsInput {
  productId: string;
  cursor: string | null;
  limit: number;
}

export interface GetProductReviewsResult {
  items: ReviewProps[];
  nextCursor: string | null;
}

/**
 * GET /api/v1/catalog/products/:id/reviews — FR-PRD-004, public,
 * cursor-paginated (API Spec §1.5). Mirrors GetProductVariantsUseCase's
 * shape (product-existence check, then a scoped repository read, mapped to
 * plain Props — same "use case returns Props, not domain entities"
 * precedent as GetProductsUseCase).
 */
@Injectable()
export class GetProductReviewsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
  ) {}

  async execute(
    input: GetProductReviewsInput,
  ): Promise<GetProductReviewsResult> {
    const product = await this.products.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError();
    }

    const page = await this.reviews.findByProductIdPaginated({
      productId: input.productId,
      cursor: input.cursor,
      limit: input.limit,
    });

    return {
      items: page.items.map((review) => review.snapshot),
      nextCursor: page.nextCursor,
    };
  }
}
