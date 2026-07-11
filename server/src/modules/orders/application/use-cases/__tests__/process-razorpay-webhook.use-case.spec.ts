import { randomUUID } from 'node:crypto';
import { ProcessRazorpayWebhookUseCase } from '../process-razorpay-webhook.use-case';
import {
  Order,
  type OrderLineProps,
} from '../../../domain/entities/order.entity';
import { InMemoryOrderRepository } from '../../__tests__/fakes/in-memory-order.repository';
import {
  FakeAuditLogger,
  FakeProductLookupRepository,
  FakeWebhookSignatureVerifier,
} from '../../__tests__/fakes/fake-ports';
import {
  InvalidWebhookSignatureError,
  OrderNotFoundError,
} from '../../../domain/errors/order.errors';

const VALID_SIGNATURE = 'valid-signature';

function buildUseCase(validSignature = VALID_SIGNATURE) {
  const orders = new InMemoryOrderRepository();
  const productLookup = new FakeProductLookupRepository();
  const signatureVerifier = new FakeWebhookSignatureVerifier(validSignature);
  const auditLogger = new FakeAuditLogger();

  const useCase = new ProcessRazorpayWebhookUseCase(
    orders,
    productLookup,
    signatureVerifier,
    auditLogger,
  );

  return { useCase, orders, productLookup, auditLogger };
}

async function seedPendingOrder(
  orders: InMemoryOrderRepository,
  productLookup: FakeProductLookupRepository,
  razorpayOrderId: string,
) {
  const variantId = randomUUID();
  productLookup.seed({
    id: variantId,
    productId: randomUUID(),
    sku: 'SKU-WEBHOOK',
    priceMinor: 10_000n,
    stockQuantity: 20,
    productStatus: 'active',
    vendorId: 'vendor-1',
    categoryTaxRateBps: 500,
  });

  const lines: OrderLineProps[] = [
    {
      id: randomUUID(),
      productVariantId: variantId,
      vendorId: 'vendor-1',
      quantity: 3,
      unitPriceMinor: 10_000n,
      taxMinor: 1500n,
      commissionBpsSnapshot: null,
      status: 'pending',
    },
  ];

  const order = Order.create({
    id: randomUUID(),
    userId: 'user-1',
    shippingAddressId: randomUUID(),
    billingAddressId: randomUUID(),
    subtotalMinor: 30_000n,
    taxMinor: 1500n,
    shippingMinor: 5000n,
    totalMinor: 36_500n,
    lines,
    now: new Date(),
  });
  order.attachGatewayOrderId(razorpayOrderId, new Date());
  await orders.save(order);

  return { order, variantId };
}

describe('ProcessRazorpayWebhookUseCase', () => {
  it('rejects a webhook with an invalid signature and does NOT change order state or stock (BR-ORD-01)', async () => {
    const { useCase, orders, productLookup, auditLogger } = buildUseCase();
    const razorpayOrderId = `order_stub_${randomUUID()}`;
    const { order, variantId } = await seedPendingOrder(
      orders,
      productLookup,
      razorpayOrderId,
    );
    const stockBefore = productLookup.stockOf(variantId);

    await expect(
      useCase.execute({
        rawBody: JSON.stringify({
          razorpayOrderId,
          razorpayPaymentId: 'pay_fake',
        }),
        signatureHeader: 'this-is-a-tampered-signature',
        payload: { razorpayOrderId, razorpayPaymentId: 'pay_fake' },
        ipAddress: '10.0.0.1',
      }),
    ).rejects.toBeInstanceOf(InvalidWebhookSignatureError);

    const reloaded = await orders.findById(order.id);
    expect(reloaded?.status).toBe('pending_payment');
    expect(productLookup.stockOf(variantId)).toBe(stockBefore);
    expect(auditLogger.events.map((e) => e.action)).toContain(
      'order.webhook_signature_invalid',
    );
    expect(auditLogger.events.map((e) => e.action)).not.toContain('order.paid');
  });

  it('transitions the order to paid and decrements stock on a validly-signed webhook', async () => {
    const { useCase, orders, productLookup, auditLogger } = buildUseCase();
    const razorpayOrderId = `order_stub_${randomUUID()}`;
    const { order, variantId } = await seedPendingOrder(
      orders,
      productLookup,
      razorpayOrderId,
    );
    const stockBefore = productLookup.stockOf(variantId) ?? 0;

    const result = await useCase.execute({
      rawBody: JSON.stringify({
        razorpayOrderId,
        razorpayPaymentId: 'pay_real123',
      }),
      signatureHeader: VALID_SIGNATURE,
      payload: { razorpayOrderId, razorpayPaymentId: 'pay_real123' },
      ipAddress: '10.0.0.1',
    });

    expect(result.status).toBe('paid');

    const reloaded = await orders.findById(order.id);
    expect(reloaded?.status).toBe('paid');
    expect(reloaded?.snapshot.paidAt).not.toBeNull();
    expect(reloaded?.snapshot.razorpayPaymentId).toBe('pay_real123');

    // order line quantity was 3
    expect(productLookup.stockOf(variantId)).toBe(stockBefore - 3);
    expect(auditLogger.events.map((e) => e.action)).toContain('order.paid');
  });

  it('is idempotent: replaying the same valid webhook does not double-decrement stock', async () => {
    const { useCase, orders, productLookup } = buildUseCase();
    const razorpayOrderId = `order_stub_${randomUUID()}`;
    const { variantId } = await seedPendingOrder(
      orders,
      productLookup,
      razorpayOrderId,
    );
    const stockBefore = productLookup.stockOf(variantId) ?? 0;

    const input = {
      rawBody: JSON.stringify({
        razorpayOrderId,
        razorpayPaymentId: 'pay_real123',
      }),
      signatureHeader: VALID_SIGNATURE,
      payload: { razorpayOrderId, razorpayPaymentId: 'pay_real123' },
      ipAddress: '10.0.0.1',
    };

    const first = await useCase.execute(input);
    expect(first.status).toBe('paid');
    const stockAfterFirst = productLookup.stockOf(variantId);

    const second = await useCase.execute(input);
    expect(second.status).toBe('already_paid');

    // Stock must not move on the replay.
    expect(productLookup.stockOf(variantId)).toBe(stockAfterFirst);
    expect(productLookup.stockOf(variantId)).toBe(stockBefore - 3);
  });

  it('throws OrderNotFoundError for a validly-signed webhook referencing an unknown gateway order id', async () => {
    const { useCase } = buildUseCase();
    const unknownId = `order_stub_${randomUUID()}`;

    await expect(
      useCase.execute({
        rawBody: JSON.stringify({
          razorpayOrderId: unknownId,
          razorpayPaymentId: 'pay_x',
        }),
        signatureHeader: VALID_SIGNATURE,
        payload: { razorpayOrderId: unknownId, razorpayPaymentId: 'pay_x' },
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
