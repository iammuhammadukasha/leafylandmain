import { randomUUID } from 'node:crypto';
import { SubmitReviewUseCase } from '../submit-review.use-case';
import { Product } from '../../../domain/entities/product.entity';
import { ProductVariant } from '../../../domain/entities/product-variant.entity';
import { InMemoryProductRepository } from '../../__tests__/fakes/in-memory-product.repository';
import { InMemoryProductVariantRepository } from '../../__tests__/fakes/in-memory-product-variant.repository';
import { InMemoryReviewRepository } from '../../__tests__/fakes/in-memory-review.repository';
import {
  FakeAuditLogger,
  FakeOrderLineLookupRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  ProductNotFoundError,
  ReviewAlreadyExistsError,
  ReviewNotEligibleError,
} from '../../../domain/errors/product.errors';
import type { OrderLineSummary } from '../../../domain/repositories/order-line-lookup.repository';

function buildUseCase() {
  const products = new InMemoryProductRepository();
  const variants = new InMemoryProductVariantRepository();
  const reviews = new InMemoryReviewRepository();
  const orderLineLookup = new FakeOrderLineLookupRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new SubmitReviewUseCase(
    products,
    variants,
    reviews,
    orderLineLookup,
    auditLogger,
  );

  return { useCase, products, variants, reviews, orderLineLookup, auditLogger };
}

async function seedProductWithVariant(
  products: InMemoryProductRepository,
  variants: InMemoryProductVariantRepository,
): Promise<{ productId: string; variantId: string }> {
  const product = Product.create({
    id: randomUUID(),
    vendorId: randomUUID(),
    categoryId: randomUUID(),
    brandId: null,
    title: 'Organic Honey',
    description: null,
    isOrganicClaim: false,
    organicCertDocumentId: null,
    now: new Date(),
  });
  await products.save(product);

  const variant = ProductVariant.create({
    id: randomUUID(),
    productId: product.id,
    sku: `SKU-${randomUUID()}`,
    attributes: {},
    priceMinor: 10000n,
    stockQuantity: 50,
    lowStockThreshold: 5,
    now: new Date(),
  });
  await variants.save(variant);

  return { productId: product.id, variantId: variant.id };
}

function orderLine(
  overrides: Partial<OrderLineSummary> &
    Pick<OrderLineSummary, 'productVariantId'>,
): OrderLineSummary {
  return {
    id: randomUUID(),
    orderId: randomUUID(),
    orderUserId: 'buyer-1',
    orderStatus: 'paid',
    ...overrides,
  };
}

describe('SubmitReviewUseCase', () => {
  it('submits a review when the order line is owned by the caller, for this product, and paid', async () => {
    const { useCase, products, variants, reviews, orderLineLookup } =
      buildUseCase();
    const { productId, variantId } = await seedProductWithVariant(
      products,
      variants,
    );
    const line = orderLine({
      productVariantId: variantId,
      orderUserId: 'buyer-1',
    });
    orderLineLookup.seed(line);

    const result = await useCase.execute({
      userId: 'buyer-1',
      productId,
      orderLineId: line.id,
      rating: 5,
      body: 'Excellent!',
      ipAddress: '127.0.0.1',
    });

    expect(result.rating).toBe(5);
    expect(reviews.all).toHaveLength(1);
  });

  it('rejects with ReviewNotEligibleError when the caller has no order line at all (unknown orderLineId)', async () => {
    const { useCase, products, variants } = buildUseCase();
    const { productId } = await seedProductWithVariant(products, variants);

    await expect(
      useCase.execute({
        userId: 'buyer-1',
        productId,
        orderLineId: randomUUID(),
        rating: 4,
        body: 'no order',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReviewNotEligibleError);
  });

  it('rejects with ReviewNotEligibleError when the order line exists but its order is NOT paid (critical assertion)', async () => {
    const { useCase, products, variants, orderLineLookup } = buildUseCase();
    const { productId, variantId } = await seedProductWithVariant(
      products,
      variants,
    );
    const line = orderLine({
      productVariantId: variantId,
      orderUserId: 'buyer-1',
      orderStatus: 'pending_payment',
    });
    orderLineLookup.seed(line);

    await expect(
      useCase.execute({
        userId: 'buyer-1',
        productId,
        orderLineId: line.id,
        rating: 3,
        body: 'unpaid order should not qualify',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReviewNotEligibleError);
  });

  it('rejects with ReviewNotEligibleError when the order line belongs to a different user', async () => {
    const { useCase, products, variants, orderLineLookup } = buildUseCase();
    const { productId, variantId } = await seedProductWithVariant(
      products,
      variants,
    );
    const line = orderLine({
      productVariantId: variantId,
      orderUserId: 'someone-else',
      orderStatus: 'paid',
    });
    orderLineLookup.seed(line);

    await expect(
      useCase.execute({
        userId: 'buyer-1',
        productId,
        orderLineId: line.id,
        rating: 3,
        body: 'not my order',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReviewNotEligibleError);
  });

  it('rejects with ReviewNotEligibleError when the paid order line is for a DIFFERENT product', async () => {
    const { useCase, products, variants, orderLineLookup } = buildUseCase();
    const { variantId } = await seedProductWithVariant(products, variants);
    const { productId: otherProductId } = await seedProductWithVariant(
      products,
      variants,
    );
    const line = orderLine({
      productVariantId: variantId,
      orderUserId: 'buyer-1',
      orderStatus: 'paid',
    });
    orderLineLookup.seed(line);

    await expect(
      useCase.execute({
        userId: 'buyer-1',
        productId: otherProductId,
        orderLineId: line.id,
        rating: 3,
        body: 'wrong product',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReviewNotEligibleError);
  });

  it('rejects with ProductNotFoundError for a nonexistent product', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        userId: 'buyer-1',
        productId: randomUUID(),
        orderLineId: randomUUID(),
        rating: 3,
        body: 'no product',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('rejects a SECOND review on the same orderLineId with ReviewAlreadyExistsError (409 pattern)', async () => {
    const { useCase, products, variants, orderLineLookup } = buildUseCase();
    const { productId, variantId } = await seedProductWithVariant(
      products,
      variants,
    );
    const line = orderLine({
      productVariantId: variantId,
      orderUserId: 'buyer-1',
    });
    orderLineLookup.seed(line);

    await useCase.execute({
      userId: 'buyer-1',
      productId,
      orderLineId: line.id,
      rating: 5,
      body: 'first review',
      ipAddress: null,
    });

    await expect(
      useCase.execute({
        userId: 'buyer-1',
        productId,
        orderLineId: line.id,
        rating: 1,
        body: 'trying again',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReviewAlreadyExistsError);
  });
});
