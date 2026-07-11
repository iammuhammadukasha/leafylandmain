import { Inject, Injectable } from '@nestjs/common';
import type { ProductProps } from '../../domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../domain/repositories/category.repository';
import {
  VENDOR_LOOKUP_REPOSITORY,
  type VendorLookupRepository,
} from '../../domain/repositories/vendor-lookup.repository';
import {
  CategoryNotFoundError,
  ProductForbiddenError,
  ProductNotFoundError,
} from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface UpdateMyProductInput {
  userId: string;
  productId: string;
  title?: string;
  description?: string | null;
  categoryId?: string;
  brandId?: string | null;
  ipAddress: string | null;
}

export type UpdateMyProductResult = ProductProps;

/**
 * PATCH /api/v1/vendors/me/products/:id — FR-VND-005, ownership-scoped.
 * Only title/description/category/brand are editable (organic-claim
 * changes are out of scope for this endpoint — see Product entity's
 * `update()` doc comment).
 */
@Injectable()
export class UpdateMyProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categories: CategoryRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: UpdateMyProductInput): Promise<UpdateMyProductResult> {
    const vendor = await this.vendorLookup.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new ProductForbiddenError(
        'You must have a vendor account to manage products.',
      );
    }

    const product = await this.products.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError();
    }
    if (product.vendorId !== vendor.id) {
      throw new ProductForbiddenError('You do not own this product.');
    }

    if (input.categoryId !== undefined) {
      const category = await this.categories.findById(input.categoryId);
      if (!category) {
        throw new CategoryNotFoundError();
      }
    }

    const now = new Date();
    product.update({
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      brandId: input.brandId,
      now,
    });

    await this.products.save(product);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'product.updated',
      targetType: 'product',
      targetId: product.id,
      ipAddress: input.ipAddress,
    });

    return product.snapshot;
  }
}
