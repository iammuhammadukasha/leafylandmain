import { randomUUID } from 'node:crypto';
import { CreateProductVariantUseCase } from '../create-product-variant.use-case';
import { Product } from '../../../domain/entities/product.entity';
import { InMemoryProductRepository } from '../../__tests__/fakes/in-memory-product.repository';
import { InMemoryProductVariantRepository } from '../../__tests__/fakes/in-memory-product-variant.repository';
import {
  FakeAuditLogger,
  FakeVendorLookupRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  ProductForbiddenError,
  ProductNotFoundError,
  SkuTakenError,
} from '../../../domain/errors/product.errors';

function buildUseCase() {
  const products = new InMemoryProductRepository();
  const variants = new InMemoryProductVariantRepository();
  const vendorLookup = new FakeVendorLookupRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new CreateProductVariantUseCase(
    products,
    variants,
    vendorLookup,
    auditLogger,
  );

  return { useCase, products, variants, vendorLookup, auditLogger };
}

async function seedProduct(
  products: InMemoryProductRepository,
  vendorId: string,
): Promise<Product> {
  const product = Product.create({
    id: randomUUID(),
    vendorId,
    categoryId: randomUUID(),
    brandId: null,
    title: 'Rice',
    description: null,
    isOrganicClaim: false,
    organicCertDocumentId: null,
    now: new Date(),
  });
  await products.save(product);
  return product;
}

describe('CreateProductVariantUseCase', () => {
  it('creates a variant with a unique SKU', async () => {
    const { useCase, products, vendorLookup, variants } = buildUseCase();
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'verified',
    });
    const product = await seedProduct(products, 'vendor-1');

    const result = await useCase.execute({
      userId: 'owner-1',
      productId: product.id,
      sku: 'RICE-1KG',
      attributes: { size: '1kg' },
      priceMinor: 49900n,
      stockQuantity: 100,
      lowStockThreshold: 10,
      ipAddress: '127.0.0.1',
    });

    expect(result.sku).toBe('RICE-1KG');
    expect(variants.all).toHaveLength(1);
  });

  it('throws SkuTakenError when the SKU already exists on ANY product (platform-wide uniqueness)', async () => {
    const { useCase, products, vendorLookup } = buildUseCase();
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'verified',
    });
    const productA = await seedProduct(products, 'vendor-1');
    const productB = await seedProduct(products, 'vendor-1');

    await useCase.execute({
      userId: 'owner-1',
      productId: productA.id,
      sku: 'DUP-SKU',
      attributes: {},
      priceMinor: 1000n,
      stockQuantity: 5,
      lowStockThreshold: 1,
      ipAddress: null,
    });

    await expect(
      useCase.execute({
        userId: 'owner-1',
        productId: productB.id,
        sku: 'DUP-SKU',
        attributes: {},
        priceMinor: 2000n,
        stockQuantity: 5,
        lowStockThreshold: 1,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(SkuTakenError);
  });

  it('throws ProductForbiddenError when the caller does not own the product', async () => {
    const { useCase, products, vendorLookup } = buildUseCase();
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'verified',
    });
    vendorLookup.seed({
      id: 'vendor-2',
      ownerUserId: 'owner-2',
      status: 'verified',
    });
    const product = await seedProduct(products, 'vendor-1');

    await expect(
      useCase.execute({
        userId: 'owner-2',
        productId: product.id,
        sku: 'SKU-X',
        attributes: {},
        priceMinor: 1000n,
        stockQuantity: 5,
        lowStockThreshold: 1,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ProductForbiddenError);
  });

  it('throws ProductNotFoundError for a nonexistent product', async () => {
    const { useCase, vendorLookup } = buildUseCase();
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'verified',
    });

    await expect(
      useCase.execute({
        userId: 'owner-1',
        productId: randomUUID(),
        sku: 'SKU-X',
        attributes: {},
        priceMinor: 1000n,
        stockQuantity: 5,
        lowStockThreshold: 1,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});
