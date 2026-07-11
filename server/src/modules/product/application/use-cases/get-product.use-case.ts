import { Inject, Injectable } from '@nestjs/common';
import type { ProductProps } from '../../domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import { ProductNotFoundError } from '../../domain/errors/product.errors';

export interface GetProductInput {
  productId: string;
}

export type GetProductResult = ProductProps;

/**
 * GET /api/v1/catalog/products/:id — Public, FR-PRD-002. Only `active`
 * products are visible to the public — draft/delisted products 404 to
 * non-owners (task requirement; this slice has no "owner viewing their own
 * draft via the public endpoint" special case — vendors use
 * GET /vendors/me/products for that).
 */
@Injectable()
export class GetProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
  ) {}

  async execute(input: GetProductInput): Promise<GetProductResult> {
    const product = await this.products.findById(input.productId);
    if (!product || product.status !== 'active') {
      throw new ProductNotFoundError();
    }
    return product.snapshot;
  }
}
