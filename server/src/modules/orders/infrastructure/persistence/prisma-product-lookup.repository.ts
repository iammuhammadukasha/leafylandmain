import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  ProductLookupRepository,
  ProductVariantSummary,
} from '../../domain/repositories/product-lookup.repository';

/**
 * Read-mostly lookup over the Product-context `product_variants` /
 * `products` / `categories` tables (Volume 04 §5), scoped to what Orders'
 * use cases need. See the port's doc comment
 * (domain/repositories/product-lookup.repository.ts) for why this lives in
 * Orders' own infrastructure layer rather than importing Product's
 * PrismaProductVariantRepository/domain entity directly — same precedent
 * as Product's own PrismaVendorLookupRepository.
 */
@Injectable()
export class PrismaProductLookupRepository implements ProductLookupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findVariantById(id: string): Promise<ProductVariantSummary | null> {
    const row = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { product: { include: { category: true } } },
    });
    if (!row || row.deletedAt) {
      return null;
    }
    return {
      id: row.id,
      productId: row.productId,
      sku: row.sku,
      priceMinor: row.priceMinor,
      stockQuantity: row.stockQuantity,
      productStatus: row.product.status,
      vendorId: row.product.vendorId,
      categoryTaxRateBps: row.product.category.taxRateBps,
    };
  }

  /** BR-ORD-01 path only — see port doc comment. Uses an atomic
   * `decrement` (not read-then-write) so concurrent webhook deliveries
   * for different orders can't race each other on the same variant. */
  async decrementStock(variantId: string, quantity: number): Promise<void> {
    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        stockQuantity: { decrement: quantity },
        version: { increment: 1 },
      },
    });
  }
}
