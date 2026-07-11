import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ProductVariant,
  type ProductVariantProps,
} from '../../domain/entities/product-variant.entity';
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
  SkuTakenError,
} from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface CreateProductVariantInput {
  userId: string;
  productId: string;
  sku: string;
  attributes: Record<string, unknown>;
  priceMinor: bigint;
  stockQuantity: number;
  lowStockThreshold: number;
  ipAddress: string | null;
}

export type CreateProductVariantResult = ProductVariantProps;

/**
 * POST /api/v1/vendors/me/products/:id/variants — FR-VND-005. SKU
 * uniqueness enforced platform-wide (VR-PRD, Volume 02 §5.2) — checked via
 * a repository lookup BEFORE the domain factory runs (a domain entity
 * cannot make a DB round trip itself); violation maps to 409 CONFLICT /
 * SKU_TAKEN (API Spec §5.4).
 */
@Injectable()
export class CreateProductVariantUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_VARIANT_REPOSITORY)
    private readonly variants: ProductVariantRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(
    input: CreateProductVariantInput,
  ): Promise<CreateProductVariantResult> {
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

    const existingSku = await this.variants.findBySku(input.sku);
    if (existingSku) {
      throw new SkuTakenError();
    }

    const now = new Date();
    const variant = ProductVariant.create({
      id: randomUUID(),
      productId: input.productId,
      sku: input.sku,
      attributes: input.attributes,
      priceMinor: input.priceMinor,
      stockQuantity: input.stockQuantity,
      lowStockThreshold: input.lowStockThreshold,
      now,
    });

    await this.variants.save(variant);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'product.variant_created',
      targetType: 'product_variant',
      targetId: variant.id,
      diff: { sku: input.sku },
      ipAddress: input.ipAddress,
    });

    return variant.snapshot;
  }
}
