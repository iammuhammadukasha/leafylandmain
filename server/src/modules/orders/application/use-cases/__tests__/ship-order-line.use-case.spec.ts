import { randomUUID } from 'node:crypto';
import { ShipOrderLineUseCase } from '../ship-order-line.use-case';
import {
  Order,
  type OrderLineProps,
} from '../../../domain/entities/order.entity';
import { InMemoryOrderRepository } from '../../__tests__/fakes/in-memory-order.repository';
import { InMemoryShipmentRepository } from '../../__tests__/fakes/in-memory-shipment.repository';
import {
  FakeAuditLogger,
  FakeOrdersVendorLookupRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  OrderForbiddenError,
  OrderLineForbiddenError,
  OrderLineNotFoundError,
  OrderNotPaidError,
} from '../../../domain/errors/order.errors';

function buildUseCase() {
  const orders = new InMemoryOrderRepository();
  const shipments = new InMemoryShipmentRepository();
  const vendorLookup = new FakeOrdersVendorLookupRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new ShipOrderLineUseCase(
    orders,
    shipments,
    vendorLookup,
    auditLogger,
  );

  return { useCase, orders, shipments, vendorLookup, auditLogger };
}

function buildLine(overrides: Partial<OrderLineProps> = {}): OrderLineProps {
  return {
    id: randomUUID(),
    productVariantId: randomUUID(),
    vendorId: randomUUID(),
    quantity: 1,
    unitPriceMinor: 10000n,
    taxMinor: 500n,
    commissionBpsSnapshot: null,
    status: 'pending',
    ...overrides,
  };
}

function buildPaidOrder(lines: OrderLineProps[]): Order {
  const order = Order.create({
    id: randomUUID(),
    userId: randomUUID(),
    shippingAddressId: randomUUID(),
    billingAddressId: randomUUID(),
    subtotalMinor: 10000n,
    taxMinor: 500n,
    shippingMinor: 0n,
    totalMinor: 10500n,
    lines,
    now: new Date(),
  });
  order.markPaid('pay_test123', new Date());
  return order;
}

describe('ShipOrderLineUseCase', () => {
  it('ships a paid order line owned by the caller vendor, creating a shipment', async () => {
    const { useCase, orders, shipments, vendorLookup } = buildUseCase();
    const vendorOwnerId = 'vendor-owner-1';
    const vendorId = randomUUID();
    vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

    const line = buildLine({ vendorId });
    const order = buildPaidOrder([line]);
    await orders.save(order);

    const result = await useCase.execute({
      userId: vendorOwnerId,
      orderLineId: line.id,
      carrier: 'BlueDart',
      trackingNumber: 'BD123456',
      ipAddress: '127.0.0.1',
    });

    expect(result.status).toBe('shipped');
    expect(result.carrier).toBe('BlueDart');
    expect(result.trackingNumber).toBe('BD123456');
    expect(shipments.all).toHaveLength(1);
  });

  it('rejects with OrderForbiddenError when the caller has no vendor account', async () => {
    const { useCase, orders } = buildUseCase();
    const line = buildLine();
    const order = buildPaidOrder([line]);
    await orders.save(order);

    await expect(
      useCase.execute({
        userId: 'no-vendor-user',
        orderLineId: line.id,
        carrier: 'BlueDart',
        trackingNumber: 'BD123456',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderForbiddenError);
  });

  it('rejects with OrderLineNotFoundError for an unknown orderLineId', async () => {
    const { useCase, vendorLookup } = buildUseCase();
    const vendorOwnerId = 'vendor-owner-1';
    vendorLookup.seed({ id: randomUUID(), ownerUserId: vendorOwnerId });

    await expect(
      useCase.execute({
        userId: vendorOwnerId,
        orderLineId: randomUUID(),
        carrier: 'BlueDart',
        trackingNumber: 'BD123456',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderLineNotFoundError);
  });

  it('rejects with OrderLineForbiddenError when the order line belongs to a DIFFERENT vendor (no data leak)', async () => {
    const { useCase, orders, vendorLookup } = buildUseCase();
    const callerVendorOwnerId = 'vendor-owner-caller';
    vendorLookup.seed({ id: randomUUID(), ownerUserId: callerVendorOwnerId });

    const otherVendorId = randomUUID();
    const line = buildLine({ vendorId: otherVendorId });
    const order = buildPaidOrder([line]);
    await orders.save(order);

    await expect(
      useCase.execute({
        userId: callerVendorOwnerId,
        orderLineId: line.id,
        carrier: 'BlueDart',
        trackingNumber: 'BD123456',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderLineForbiddenError);
  });

  it('rejects with OrderNotPaidError when the containing order is still pending_payment', async () => {
    const { useCase, orders, vendorLookup } = buildUseCase();
    const vendorOwnerId = 'vendor-owner-1';
    const vendorId = randomUUID();
    vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

    const line = buildLine({ vendorId });
    // NOT paid — Order.create() alone leaves status pending_payment.
    const order = Order.create({
      id: randomUUID(),
      userId: randomUUID(),
      shippingAddressId: randomUUID(),
      billingAddressId: randomUUID(),
      subtotalMinor: 10000n,
      taxMinor: 500n,
      shippingMinor: 0n,
      totalMinor: 10500n,
      lines: [line],
      now: new Date(),
    });
    await orders.save(order);

    await expect(
      useCase.execute({
        userId: vendorOwnerId,
        orderLineId: line.id,
        carrier: 'BlueDart',
        trackingNumber: 'BD123456',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderNotPaidError);
  });

  it('re-shipping (calling ship twice) updates the SAME shipment rather than creating a second one', async () => {
    const { useCase, orders, shipments, vendorLookup } = buildUseCase();
    const vendorOwnerId = 'vendor-owner-1';
    const vendorId = randomUUID();
    vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

    const line = buildLine({ vendorId });
    const order = buildPaidOrder([line]);
    await orders.save(order);

    await useCase.execute({
      userId: vendorOwnerId,
      orderLineId: line.id,
      carrier: 'BlueDart',
      trackingNumber: 'BD-FIRST',
      ipAddress: null,
    });

    const second = await useCase.execute({
      userId: vendorOwnerId,
      orderLineId: line.id,
      carrier: 'Delhivery',
      trackingNumber: 'DL-SECOND',
      ipAddress: null,
    });

    expect(shipments.all).toHaveLength(1);
    expect(second.carrier).toBe('Delhivery');
    expect(second.trackingNumber).toBe('DL-SECOND');
  });

  it("shipping ONE line ships the whole shipment covering all of that vendor's lines on the order", async () => {
    const { useCase, orders, vendorLookup } = buildUseCase();
    const vendorOwnerId = 'vendor-owner-1';
    const vendorId = randomUUID();
    vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

    const lineA = buildLine({ vendorId });
    const lineB = buildLine({ vendorId });
    const order = buildPaidOrder([lineA, lineB]);
    await orders.save(order);

    const result = await useCase.execute({
      userId: vendorOwnerId,
      orderLineId: lineA.id,
      carrier: 'BlueDart',
      trackingNumber: 'BD123456',
      ipAddress: null,
    });

    expect(result.orderId).toBe(order.id);
    expect(result.vendorId).toBe(vendorId);
  });
});
