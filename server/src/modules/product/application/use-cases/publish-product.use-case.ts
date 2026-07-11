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
import {
  ProductForbiddenError,
  ProductNotFoundError,
  VendorNotVerifiedError,
} from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface PublishProductInput {
  userId: string;
  productId: string;
  ipAddress: string | null;
}

export type PublishProductResult = ProductProps;

/**
 * POST /api/v1/vendors/me/products/:id/publish — FR-VND-005. draft ->
 * active, requires the OWNING VENDOR itself to be in `verified` status
 * (Volume 07 §5.4: "requires verified vendor (VENDOR_NOT_VERIFIED
 * otherwise)"). Reuses Vendor's existing VENDOR_NOT_VERIFIED error code,
 * mapped by the interface layer, rather than inventing a new one — same
 * cross-context read via VendorLookupRepository as RegisterProductUseCase.
 */
@Injectable()
export class PublishProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: PublishProductInput): Promise<PublishProductResult> {
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

    if (vendor.status !== 'verified') {
      throw new VendorNotVerifiedError();
    }

    const now = new Date();
    product.publish(now);
    await this.products.save(product);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'product.published',
      targetType: 'product',
      targetId: product.id,
      ipAddress: input.ipAddress,
    });

    return product.snapshot;
  }
}
