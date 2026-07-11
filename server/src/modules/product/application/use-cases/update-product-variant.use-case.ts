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
import {
  VENDOR_LOOKUP_REPOSITORY,
  type VendorLookupRepository,
} from '../../domain/repositories/vendor-lookup.repository';
import {
  ProductForbiddenError,
  ProductNotFoundError,
  ProductVariantNotFoundError,
} from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface UpdateProductVariantInput {
  userId: string;
  variantId: string;
  attributes?: Record<string, unknown>;
  priceMinor?: bigint;
  stockQuantity?: number;
  lowStockThreshold?: number;
  ipAddress: string | null;
}

export type UpdateProductVariantResult = ProductVariantProps;

/**
 * PATCH /api/v1/vendors/me/products/variants/:variantId — FR-VND-005,
 * basic field updates (task scope). Ownership is verified transitively:
 * variant -> parent product -> product.vendorId must equal the caller's
 * vendor id.
 */
@Injectable()
export class UpdateProductVariantUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_VARIANT_REPOSITORY)
    private readonly variants: ProductVariantRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(
    input: UpdateProductVariantInput,
  ): Promise<UpdateProductVariantResult> {
    const vendor = await this.vendorLookup.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new ProductForbiddenError(
        'You must have a vendor account to manage products.',
      );
    }

    const variant = await this.variants.findById(input.variantId);
    if (!variant) {
      throw new ProductVariantNotFoundError();
    }

    const product = await this.products.findById(variant.productId);
    if (!product) {
      throw new ProductNotFoundError();
    }
    if (product.vendorId !== vendor.id) {
      throw new ProductForbiddenError('You do not own this product.');
    }

    const now = new Date();
    variant.update({
      attributes: input.attributes,
      priceMinor: input.priceMinor,
      stockQuantity: input.stockQuantity,
      lowStockThreshold: input.lowStockThreshold,
      now,
    });

    await this.variants.save(variant);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'product.variant_updated',
      targetType: 'product_variant',
      targetId: variant.id,
      ipAddress: input.ipAddress,
    });

    return variant.snapshot;
  }
}
