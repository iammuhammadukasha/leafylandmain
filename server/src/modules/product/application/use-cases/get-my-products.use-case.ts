import { Inject, Injectable } from '@nestjs/common';
import type { ProductProps } from '../../domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  VENDOR_LOOKUP_REPOSITORY,
  type VendorLookupRepository,
} from '../../domain/repositories/vendor-lookup.repository';
import { ProductForbiddenError } from '../../domain/errors/product.errors';

export interface GetMyProductsInput {
  userId: string;
}

export type GetMyProductsResult = ProductProps[];

/**
 * GET /api/v1/vendors/me/products — FR-VND-005. Scoped to the caller's own
 * vendor (same structural-scoping precedent as the rest of this slice).
 */
@Injectable()
export class GetMyProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
  ) {}

  async execute(input: GetMyProductsInput): Promise<GetMyProductsResult> {
    const vendor = await this.vendorLookup.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new ProductForbiddenError(
        'You must have a vendor account to view products.',
      );
    }

    const products = await this.products.findByVendorId(vendor.id);
    return products.map((product) => product.snapshot);
  }
}
