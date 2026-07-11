import { randomUUID } from 'node:crypto';
import { GetProductUseCase } from '../get-product.use-case';
import { Product } from '../../../domain/entities/product.entity';
import { InMemoryProductRepository } from '../../__tests__/fakes/in-memory-product.repository';
import { ProductNotFoundError } from '../../../domain/errors/product.errors';

function buildUseCase() {
  const products = new InMemoryProductRepository();
  const useCase = new GetProductUseCase(products);
  return { useCase, products };
}

describe('GetProductUseCase', () => {
  it('returns an active product', async () => {
    const { useCase, products } = buildUseCase();
    const product = Product.create({
      id: randomUUID(),
      vendorId: 'vendor-1',
      categoryId: randomUUID(),
      brandId: null,
      title: 'Rice',
      description: null,
      isOrganicClaim: false,
      organicCertDocumentId: null,
      now: new Date(),
    });
    product.publish(new Date());
    await products.save(product);

    const result = await useCase.execute({ productId: product.id });
    expect(result.status).toBe('active');
  });

  it('throws ProductNotFoundError for a draft product (not publicly visible)', async () => {
    const { useCase, products } = buildUseCase();
    const product = Product.create({
      id: randomUUID(),
      vendorId: 'vendor-1',
      categoryId: randomUUID(),
      brandId: null,
      title: 'Rice',
      description: null,
      isOrganicClaim: false,
      organicCertDocumentId: null,
      now: new Date(),
    });
    await products.save(product);

    await expect(
      useCase.execute({ productId: product.id }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('throws ProductNotFoundError for a delisted product', async () => {
    const { useCase, products } = buildUseCase();
    const product = Product.create({
      id: randomUUID(),
      vendorId: 'vendor-1',
      categoryId: randomUUID(),
      brandId: null,
      title: 'Rice',
      description: null,
      isOrganicClaim: false,
      organicCertDocumentId: null,
      now: new Date(),
    });
    product.publish(new Date());
    product.delist(new Date());
    await products.save(product);

    await expect(
      useCase.execute({ productId: product.id }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('throws ProductNotFoundError for a nonexistent product id', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({ productId: randomUUID() }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});
