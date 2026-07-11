import type { ProductVariant } from '../../../domain/entities/product-variant.entity';
import type { ProductVariantRepository } from '../../../domain/repositories/product-variant.repository';

export class InMemoryProductVariantRepository implements ProductVariantRepository {
  private readonly variantsById = new Map<string, ProductVariant>();

  findById(id: string): Promise<ProductVariant | null> {
    return Promise.resolve(this.variantsById.get(id) ?? null);
  }

  findByProductId(productId: string): Promise<ProductVariant[]> {
    return Promise.resolve(
      [...this.variantsById.values()].filter((v) => v.productId === productId),
    );
  }

  findBySku(sku: string): Promise<ProductVariant | null> {
    for (const variant of this.variantsById.values()) {
      if (variant.sku === sku) return Promise.resolve(variant);
    }
    return Promise.resolve(null);
  }

  save(variant: ProductVariant): Promise<void> {
    this.variantsById.set(variant.id, variant);
    return Promise.resolve();
  }

  get all(): ProductVariant[] {
    return [...this.variantsById.values()];
  }
}
