import { randomUUID } from 'node:crypto';
import { AddCartLineUseCase } from '../add-cart-line.use-case';
import { InMemoryCartRepository } from '../../__tests__/fakes/in-memory-cart.repository';
import { FakeProductLookupRepository } from '../../__tests__/fakes/fake-ports';
import { ProductVariantNotAvailableError } from '../../../domain/errors/order.errors';

function buildUseCase() {
  const carts = new InMemoryCartRepository();
  const productLookup = new FakeProductLookupRepository();
  const useCase = new AddCartLineUseCase(carts, productLookup);
  return { useCase, carts, productLookup };
}

describe('AddCartLineUseCase', () => {
  it('adds a new line when the variant belongs to an active product', async () => {
    const { useCase, productLookup } = buildUseCase();
    const variantId = randomUUID();
    productLookup.seed({
      id: variantId,
      productId: randomUUID(),
      sku: 'SKU-A',
      priceMinor: 5000n,
      stockQuantity: 10,
      productStatus: 'active',
      vendorId: 'vendor-1',
      categoryTaxRateBps: 500,
    });

    const result = await useCase.execute({
      userId: 'user-1',
      productVariantId: variantId,
      quantity: 2,
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity).toBe(2);
  });

  it('increments an existing line for the same variant instead of duplicating it', async () => {
    const { useCase, productLookup } = buildUseCase();
    const variantId = randomUUID();
    productLookup.seed({
      id: variantId,
      productId: randomUUID(),
      sku: 'SKU-B',
      priceMinor: 5000n,
      stockQuantity: 10,
      productStatus: 'active',
      vendorId: 'vendor-1',
      categoryTaxRateBps: 500,
    });

    await useCase.execute({
      userId: 'user-1',
      productVariantId: variantId,
      quantity: 1,
    });
    const result = await useCase.execute({
      userId: 'user-1',
      productVariantId: variantId,
      quantity: 2,
    });

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].quantity).toBe(3);
  });

  it('rejects a variant belonging to a draft product', async () => {
    const { useCase, productLookup } = buildUseCase();
    const variantId = randomUUID();
    productLookup.seed({
      id: variantId,
      productId: randomUUID(),
      sku: 'SKU-C',
      priceMinor: 5000n,
      stockQuantity: 10,
      productStatus: 'draft',
      vendorId: 'vendor-1',
      categoryTaxRateBps: 500,
    });

    await expect(
      useCase.execute({
        userId: 'user-1',
        productVariantId: variantId,
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ProductVariantNotAvailableError);
  });

  it('rejects a nonexistent variant', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        userId: 'user-1',
        productVariantId: randomUUID(),
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ProductVariantNotAvailableError);
  });
});
