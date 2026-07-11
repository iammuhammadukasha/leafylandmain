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
} from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface DelistProductInput {
  userId: string;
  productId: string;
  ipAddress: string | null;
}

export type DelistProductResult = ProductProps;

/** POST /api/v1/vendors/me/products/:id/delist — FR-VND-005. */
@Injectable()
export class DelistProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: DelistProductInput): Promise<DelistProductResult> {
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

    const now = new Date();
    product.delist(now);
    await this.products.save(product);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'product.delisted',
      targetType: 'product',
      targetId: product.id,
      ipAddress: input.ipAddress,
    });

    return product.snapshot;
  }
}
