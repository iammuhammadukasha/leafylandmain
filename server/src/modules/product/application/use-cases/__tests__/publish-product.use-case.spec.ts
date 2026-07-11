import { randomUUID } from 'node:crypto';
import { PublishProductUseCase } from '../publish-product.use-case';
import { Product } from '../../../domain/entities/product.entity';
import { InMemoryProductRepository } from '../../__tests__/fakes/in-memory-product.repository';
import {
  FakeAuditLogger,
  FakeVendorLookupRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  ProductForbiddenError,
  ProductNotFoundError,
  VendorNotVerifiedError,
} from '../../../domain/errors/product.errors';

function buildUseCase() {
  const products = new InMemoryProductRepository();
  const vendorLookup = new FakeVendorLookupRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new PublishProductUseCase(
    products,
    vendorLookup,
    auditLogger,
  );

  return { useCase, products, vendorLookup, auditLogger };
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

describe('PublishProductUseCase', () => {
  it('publishes a draft product to active when the vendor is verified', async () => {
    const { useCase, products, vendorLookup } = buildUseCase();
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'verified',
    });
    const product = await seedProduct(products, 'vendor-1');

    const result = await useCase.execute({
      userId: 'owner-1',
      productId: product.id,
      ipAddress: '127.0.0.1',
    });

    expect(result.status).toBe('active');
  });

  it('throws VendorNotVerifiedError when the owning vendor is not verified', async () => {
    const { useCase, products, vendorLookup } = buildUseCase();
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'pending',
    });
    const product = await seedProduct(products, 'vendor-1');

    await expect(
      useCase.execute({
        userId: 'owner-1',
        productId: product.id,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(VendorNotVerifiedError);
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
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});
