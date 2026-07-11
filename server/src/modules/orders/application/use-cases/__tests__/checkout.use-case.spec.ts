import { randomUUID } from 'node:crypto';
import { CheckoutUseCase } from '../checkout.use-case';
import { CartPricingService } from '../../services/cart-pricing.service';
import { Cart } from '../../../domain/entities/cart.entity';
import { InMemoryCartRepository } from '../../__tests__/fakes/in-memory-cart.repository';
import { InMemoryOrderRepository } from '../../__tests__/fakes/in-memory-order.repository';
import {
  FakeAddressLookupRepository,
  FakeAuditLogger,
  FakePaymentGateway,
  FakeProductLookupRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  AddressForbiddenError,
  AddressNotFoundError,
  CartEmptyError,
  OutOfStockError,
} from '../../../domain/errors/order.errors';

function buildUseCase() {
  const carts = new InMemoryCartRepository();
  const orders = new InMemoryOrderRepository();
  const addressLookup = new FakeAddressLookupRepository();
  const productLookup = new FakeProductLookupRepository();
  const paymentGateway = new FakePaymentGateway();
  const auditLogger = new FakeAuditLogger();
  const pricing = new CartPricingService(productLookup);

  const useCase = new CheckoutUseCase(
    carts,
    orders,
    addressLookup,
    paymentGateway,
    auditLogger,
    pricing,
  );

  return {
    useCase,
    carts,
    orders,
    addressLookup,
    productLookup,
    paymentGateway,
    auditLogger,
  };
}

function seedActiveVariant(
  productLookup: FakeProductLookupRepository,
  overrides: Partial<{
    id: string;
    priceMinor: bigint;
    stockQuantity: number;
    categoryTaxRateBps: number;
    vendorId: string;
    productStatus: 'draft' | 'active' | 'delisted';
  }> = {},
) {
  const id = overrides.id ?? randomUUID();
  productLookup.seed({
    id,
    productId: randomUUID(),
    sku: 'SKU-1',
    priceMinor: overrides.priceMinor ?? 10_000n,
    stockQuantity: overrides.stockQuantity ?? 10,
    productStatus: overrides.productStatus ?? 'active',
    vendorId: overrides.vendorId ?? 'vendor-1',
    categoryTaxRateBps: overrides.categoryTaxRateBps ?? 500,
  });
  return id;
}

async function seedCartWithLine(
  carts: InMemoryCartRepository,
  userId: string,
  variantId: string,
  quantity: number,
) {
  const cart = Cart.create({ id: randomUUID(), userId, now: new Date() });
  cart.addOrIncrementLine({
    lineId: randomUUID(),
    productVariantId: variantId,
    quantity,
    now: new Date(),
  });
  await carts.save(cart);
  return cart;
}

describe('CheckoutUseCase', () => {
  it('creates a pending_payment order with correct totals and a gateway order id', async () => {
    const {
      useCase,
      carts,
      orders,
      addressLookup,
      productLookup,
      paymentGateway,
      auditLogger,
    } = buildUseCase();

    const variantId = seedActiveVariant(productLookup, {
      priceMinor: 10_000n,
      categoryTaxRateBps: 500, // 5%
      stockQuantity: 10,
    });
    await seedCartWithLine(carts, 'user-1', variantId, 2);

    const shippingAddressId = randomUUID();
    const billingAddressId = randomUUID();
    addressLookup.seed({ id: shippingAddressId, userId: 'user-1' });
    addressLookup.seed({ id: billingAddressId, userId: 'user-1' });

    const result = await useCase.execute({
      userId: 'user-1',
      shippingAddressId,
      billingAddressId,
      ipAddress: '127.0.0.1',
    });

    // subtotal = 10000 * 2 = 20000; tax = 20000 * 500/10000 = 1000;
    // shipping = 5000 flat (below free-shipping threshold);
    // total = 20000 + 1000 + 5000 = 26000
    expect(result.amountMinor).toBe('26000');
    expect(result.gatewayOrderId).toBe(paymentGateway.nextGatewayOrderId);

    const savedOrder = orders.all.find((o) => o.id === result.orderId);
    expect(savedOrder).toBeDefined();
    expect(savedOrder?.status).toBe('pending_payment');
    expect(savedOrder?.snapshot.razorpayOrderId).toBe(
      paymentGateway.nextGatewayOrderId,
    );
    expect(savedOrder?.lines).toHaveLength(1);
    expect(savedOrder?.lines[0].quantity).toBe(2);

    const cart = await carts.findById(
      (await carts.findActiveByUserId('user-1'))?.id ?? '',
    );
    // Cart should now be converted, not active.
    const allCarts = carts.all;
    expect(allCarts[0].status).toBe('converted');
    void cart;

    expect(auditLogger.events.map((e) => e.action)).toContain('order.placed');
  });

  it('rejects checkout when the cart is empty (CART_EMPTY)', async () => {
    const { useCase, addressLookup } = buildUseCase();
    const shippingAddressId = randomUUID();
    addressLookup.seed({ id: shippingAddressId, userId: 'user-1' });

    await expect(
      useCase.execute({
        userId: 'user-1',
        shippingAddressId,
        billingAddressId: shippingAddressId,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(CartEmptyError);
  });

  it('rejects checkout when stock is insufficient (re-validates at checkout time)', async () => {
    const { useCase, carts, addressLookup, productLookup } = buildUseCase();
    const variantId = seedActiveVariant(productLookup, { stockQuantity: 1 });
    await seedCartWithLine(carts, 'user-1', variantId, 5);

    const addressId = randomUUID();
    addressLookup.seed({ id: addressId, userId: 'user-1' });

    await expect(
      useCase.execute({
        userId: 'user-1',
        shippingAddressId: addressId,
        billingAddressId: addressId,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OutOfStockError);
  });

  it('rejects checkout when the shipping address does not exist', async () => {
    const { useCase, carts, productLookup } = buildUseCase();
    const variantId = seedActiveVariant(productLookup);
    await seedCartWithLine(carts, 'user-1', variantId, 1);

    await expect(
      useCase.execute({
        userId: 'user-1',
        shippingAddressId: randomUUID(),
        billingAddressId: randomUUID(),
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(AddressNotFoundError);
  });

  it('rejects checkout when the address belongs to a different user', async () => {
    const { useCase, carts, addressLookup, productLookup } = buildUseCase();
    const variantId = seedActiveVariant(productLookup);
    await seedCartWithLine(carts, 'user-1', variantId, 1);

    const addressId = randomUUID();
    addressLookup.seed({ id: addressId, userId: 'someone-else' });

    await expect(
      useCase.execute({
        userId: 'user-1',
        shippingAddressId: addressId,
        billingAddressId: addressId,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(AddressForbiddenError);
  });
});
