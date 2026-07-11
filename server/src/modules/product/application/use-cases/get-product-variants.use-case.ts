import { Inject, Injectable } from '@nestjs/common';
import type { ProductVariantProps } from '../../domain/entities/product-variant.entity';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  PRODUCT_VARIANT_REPOSITORY,
  type ProductVariantRepository,
} from '../../domain/repositories/product-variant.repository';
import { ProductNotFoundError } from '../../domain/errors/product.errors';

export interface GetProductVariantsInput {
  productId: string;
}

export type GetProductVariantsResult = ProductVariantProps[];

/**
 * GET /api/v1/catalog/products/:id/variants — Public, FR-PRD-002. Same
 * active-only visibility rule as GetProductUseCase — variants of a
 * draft/delisted product are not publicly listable either.
 */
@Injectable()
export class GetProductVariantsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_VARIANT_REPOSITORY)
    private readonly variants: ProductVariantRepository,
  ) {}

  async execute(
    input: GetProductVariantsInput,
  ): Promise<GetProductVariantsResult> {
    const product = await this.products.findById(input.productId);
    if (!product || product.status !== 'active') {
      throw new ProductNotFoundError();
    }

    const results = await this.variants.findByProductId(input.productId);
    return results.map((variant) => variant.snapshot);
  }
}
