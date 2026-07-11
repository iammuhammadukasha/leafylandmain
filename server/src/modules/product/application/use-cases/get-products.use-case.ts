import { Inject, Injectable } from '@nestjs/common';
import type { ProductProps } from '../../domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';

export interface GetProductsInput {
  cursor: string | null;
  limit: number;
}

export interface GetProductsResult {
  items: ProductProps[];
  nextCursor: string | null;
}

/**
 * GET /api/v1/catalog/products — Public, FR-PRD-005 scope-reduced (task
 * spec): active products only, cursor-paginated (Volume 02 §7 / API Spec
 * §1.5). NO OpenSearch/full-text search or faceted filtering — that's real
 * infra not stood up in this slice, deferred (see final report).
 */
@Injectable()
export class GetProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
  ) {}

  async execute(input: GetProductsInput): Promise<GetProductsResult> {
    const page = await this.products.findActivePaginated({
      cursor: input.cursor,
      limit: input.limit,
    });
    return {
      items: page.items.map((product) => product.snapshot),
      nextCursor: page.nextCursor,
    };
  }
}
