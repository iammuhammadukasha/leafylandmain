import { randomUUID } from 'node:crypto';
import { DeliverShipmentUseCase } from '../deliver-shipment.use-case';
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
  ShipmentNotShippedError,
} from '../../../domain/errors/order.errors';

function buildUseCases() {
  const orders = new InMemoryOrderRepository();
  const shipments = new InMemoryShipmentRepository();
  const vendorLookup = new FakeOrdersVendorLookupRepository();
  const auditLogger = new FakeAuditLogger();

  const shipUseCase = new ShipOrderLineUseCase(
    orders,
    shipments,
    vendorLookup,
    auditLogger,
  );
  const deliverUseCase = new DeliverShipmentUseCase(
    orders,
    shipments,
    vendorLookup,
    auditLogger,
  );

  return { shipUseCase, deliverUseCase, orders, shipments, vendorLookup };
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

describe('DeliverShipmentUseCase', () => {
  it('rejects with ShipmentNotShippedError when the line was NEVER shipped (critical ordering assertion)', async () => {
    const { deliverUseCase, orders, vendorLookup } = buildUseCases();
    const vendorOwnerId = 'vendor-owner-1';
    const vendorId = randomUUID();
    vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

    const line = buildLine({ vendorId });
    const order = buildPaidOrder([line]);
    await orders.save(order);

    await expect(
      deliverUseCase.execute({
        userId: vendorOwnerId,
        orderLineId: line.id,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ShipmentNotShippedError);
  });

  it('delivers a shipped shipment: shipment -> delivered AND the order line -> fulfilled', async () => {
    const { shipUseCase, deliverUseCase, orders, shipments, vendorLookup } =
      buildUseCases();
    const vendorOwnerId = 'vendor-owner-1';
    const vendorId = randomUUID();
    vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

    const line = buildLine({ vendorId });
    const order = buildPaidOrder([line]);
    await orders.save(order);

    await shipUseCase.execute({
      userId: vendorOwnerId,
      orderLineId: line.id,
      carrier: 'BlueDart',
      trackingNumber: 'BD123456',
      ipAddress: null,
    });

    const result = await deliverUseCase.execute({
      userId: vendorOwnerId,
      orderLineId: line.id,
      ipAddress: '127.0.0.1',
    });

    expect(result.status).toBe('delivered');
    expect(shipments.all[0]?.status).toBe('delivered');

    const persistedOrder = await orders.findById(order.id);
    const persistedLine = persistedOrder?.lines.find((l) => l.id === line.id);
    expect(persistedLine?.status).toBe('fulfilled');
  });

  it("delivering fulfills ALL of the vendor's pending lines on that order, not just the one named in the URL", async () => {
    const { shipUseCase, deliverUseCase, orders, vendorLookup } =
      buildUseCases();
    const vendorOwnerId = 'vendor-owner-1';
    const vendorId = randomUUID();
    vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

    const lineA = buildLine({ vendorId });
    const lineB = buildLine({ vendorId });
    const order = buildPaidOrder([lineA, lineB]);
    await orders.save(order);

    await shipUseCase.execute({
      userId: vendorOwnerId,
      orderLineId: lineA.id,
      carrier: 'BlueDart',
      trackingNumber: 'BD123456',
      ipAddress: null,
    });

    await deliverUseCase.execute({
      userId: vendorOwnerId,
      orderLineId: lineA.id,
      ipAddress: null,
    });

    const persistedOrder = await orders.findById(order.id);
    expect(persistedOrder?.lines.every((l) => l.status === 'fulfilled')).toBe(
      true,
    );
  });

  it('rejects a SECOND deliver call on an already-delivered shipment with ShipmentNotShippedError', async () => {
    const { shipUseCase, deliverUseCase, orders, vendorLookup } =
      buildUseCases();
    const vendorOwnerId = 'vendor-owner-1';
    const vendorId = randomUUID();
    vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

    const line = buildLine({ vendorId });
    const order = buildPaidOrder([line]);
    await orders.save(order);

    await shipUseCase.execute({
      userId: vendorOwnerId,
      orderLineId: line.id,
      carrier: 'BlueDart',
      trackingNumber: 'BD123456',
      ipAddress: null,
    });
    await deliverUseCase.execute({
      userId: vendorOwnerId,
      orderLineId: line.id,
      ipAddress: null,
    });

    await expect(
      deliverUseCase.execute({
        userId: vendorOwnerId,
        orderLineId: line.id,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ShipmentNotShippedError);
  });

  it('rejects with OrderLineForbiddenError when a DIFFERENT vendor tries to deliver', async () => {
    const { shipUseCase, deliverUseCase, orders, vendorLookup } =
      buildUseCases();
    const ownerVendorOwnerId = 'vendor-owner-owner';
    const ownerVendorId = randomUUID();
    vendorLookup.seed({ id: ownerVendorId, ownerUserId: ownerVendorOwnerId });

    const attackerVendorOwnerId = 'vendor-owner-attacker';
    vendorLookup.seed({ id: randomUUID(), ownerUserId: attackerVendorOwnerId });

    const line = buildLine({ vendorId: ownerVendorId });
    const order = buildPaidOrder([line]);
    await orders.save(order);

    await shipUseCase.execute({
      userId: ownerVendorOwnerId,
      orderLineId: line.id,
      carrier: 'BlueDart',
      trackingNumber: 'BD123456',
      ipAddress: null,
    });

    await expect(
      deliverUseCase.execute({
        userId: attackerVendorOwnerId,
        orderLineId: line.id,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderLineForbiddenError);
  });

  it('rejects with OrderForbiddenError when the caller has no vendor account', async () => {
    const { deliverUseCase, orders } = buildUseCases();
    const line = buildLine();
    const order = buildPaidOrder([line]);
    await orders.save(order);

    await expect(
      deliverUseCase.execute({
        userId: 'no-vendor-user',
        orderLineId: line.id,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderForbiddenError);
  });

  it('rejects with OrderLineNotFoundError for an unknown orderLineId', async () => {
    const { deliverUseCase, vendorLookup } = buildUseCases();
    const vendorOwnerId = 'vendor-owner-1';
    vendorLookup.seed({ id: randomUUID(), ownerUserId: vendorOwnerId });

    await expect(
      deliverUseCase.execute({
        userId: vendorOwnerId,
        orderLineId: randomUUID(),
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderLineNotFoundError);
  });
});
