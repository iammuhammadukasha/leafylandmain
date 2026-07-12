import { randomUUID } from 'node:crypto';
import { RequestReturnUseCase } from '../request-return.use-case';
import { ShipOrderLineUseCase } from '../ship-order-line.use-case';
import { DeliverShipmentUseCase } from '../deliver-shipment.use-case';
import {
  Order,
  type OrderLineProps,
} from '../../../domain/entities/order.entity';
import { InMemoryOrderRepository } from '../../__tests__/fakes/in-memory-order.repository';
import { InMemoryShipmentRepository } from '../../__tests__/fakes/in-memory-shipment.repository';
import { InMemoryReturnRepository } from '../../__tests__/fakes/in-memory-return.repository';
import { Shipment } from '../../../domain/entities/shipment.entity';
import {
  FakeAuditLogger,
  FakeOrdersVendorLookupRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  OrderLineNotOwnedError,
  ReturnAlreadyExistsError,
  ReturnWindowExpiredError,
} from '../../../domain/errors/order.errors';

function buildUseCases() {
  const orders = new InMemoryOrderRepository();
  const shipments = new InMemoryShipmentRepository();
  const returns = new InMemoryReturnRepository();
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
  const requestReturnUseCase = new RequestReturnUseCase(
    orders,
    shipments,
    returns,
    auditLogger,
  );

  return {
    shipUseCase,
    deliverUseCase,
    requestReturnUseCase,
    orders,
    shipments,
    returns,
    vendorLookup,
  };
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

function buildPaidOrder(
  lines: OrderLineProps[],
  userId: string = randomUUID(),
): Order {
  const order = Order.create({
    id: randomUUID(),
    userId,
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

/** Ships and delivers a line so it reaches `fulfilled`, returning the buyer
 * userId that owns the order. */
async function deliverLine(
  ctx: ReturnType<typeof buildUseCases>,
  line: OrderLineProps,
  buyerUserId: string,
): Promise<void> {
  const vendorOwnerId = `vendor-owner-${line.vendorId}`;
  ctx.vendorLookup.seed({ id: line.vendorId, ownerUserId: vendorOwnerId });

  const order = buildPaidOrder([line], buyerUserId);
  await ctx.orders.save(order);

  await ctx.shipUseCase.execute({
    userId: vendorOwnerId,
    orderLineId: line.id,
    carrier: 'BlueDart',
    trackingNumber: 'BD123456',
    ipAddress: null,
  });
  await ctx.deliverUseCase.execute({
    userId: vendorOwnerId,
    orderLineId: line.id,
    ipAddress: null,
  });
}

describe('RequestReturnUseCase', () => {
  it('creates a requested return for a fulfilled line owned by the caller', async () => {
    const ctx = buildUseCases();
    const buyerUserId = 'buyer-1';
    const line = buildLine();
    await deliverLine(ctx, line, buyerUserId);

    const result = await ctx.requestReturnUseCase.execute({
      userId: buyerUserId,
      orderLineId: line.id,
      reason: 'Wrong size',
      ipAddress: '127.0.0.1',
    });

    expect(result.status).toBe('requested');
    expect(result.orderLineId).toBe(line.id);
    expect(result.reason).toBe('Wrong size');
  });

  it('rejects with ReturnWindowExpiredError when the line is not yet fulfilled (still pending)', async () => {
    const ctx = buildUseCases();
    const buyerUserId = 'buyer-1';
    const line = buildLine();
    const order = buildPaidOrder([line], buyerUserId);
    await ctx.orders.save(order);
    // NOT shipped/delivered — line stays `pending`.

    await expect(
      ctx.requestReturnUseCase.execute({
        userId: buyerUserId,
        orderLineId: line.id,
        reason: 'Changed my mind',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReturnWindowExpiredError);
  });

  it('rejects with ReturnWindowExpiredError when the 7-day window has elapsed since delivery', async () => {
    const ctx = buildUseCases();
    const buyerUserId = 'buyer-1';
    const vendorId = randomUUID();
    const vendorOwnerId = 'vendor-owner-1';
    ctx.vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

    const line = buildLine({ vendorId });
    const order = buildPaidOrder([line], buyerUserId);
    await ctx.orders.save(order);

    await ctx.shipUseCase.execute({
      userId: vendorOwnerId,
      orderLineId: line.id,
      carrier: 'BlueDart',
      trackingNumber: 'BD123456',
      ipAddress: null,
    });
    await ctx.deliverUseCase.execute({
      userId: vendorOwnerId,
      orderLineId: line.id,
      ipAddress: null,
    });

    // Backdate the shipment's updatedAt to 8 days ago (past the 7-day
    // window) by re-saving a reconstituted Shipment with a stale
    // updatedAt — simplest way to simulate elapsed time without a fake
    // clock plumbed through every use case.
    const shipment = await ctx.shipments.findByOrderIdAndVendorId(
      order.id,
      vendorId,
    );
    expect(shipment).not.toBeNull();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const staleProps = { ...shipment!.snapshot, updatedAt: eightDaysAgo };
    await ctx.shipments.save(Shipment.reconstitute(staleProps));

    await expect(
      ctx.requestReturnUseCase.execute({
        userId: buyerUserId,
        orderLineId: line.id,
        reason: 'Too late now',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReturnWindowExpiredError);
  });

  it('rejects with OrderLineNotOwnedError when the caller does not own the order (no leak)', async () => {
    const ctx = buildUseCases();
    const buyerUserId = 'buyer-1';
    const line = buildLine();
    await deliverLine(ctx, line, buyerUserId);

    await expect(
      ctx.requestReturnUseCase.execute({
        userId: 'a-different-buyer',
        orderLineId: line.id,
        reason: 'Not mine',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderLineNotOwnedError);
  });

  it('rejects with OrderLineNotOwnedError for an unknown orderLineId', async () => {
    const ctx = buildUseCases();

    await expect(
      ctx.requestReturnUseCase.execute({
        userId: 'buyer-1',
        orderLineId: randomUUID(),
        reason: 'Unknown line',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrderLineNotOwnedError);
  });

  it('rejects a SECOND return request on the same line with ReturnAlreadyExistsError', async () => {
    const ctx = buildUseCases();
    const buyerUserId = 'buyer-1';
    const line = buildLine();
    await deliverLine(ctx, line, buyerUserId);

    await ctx.requestReturnUseCase.execute({
      userId: buyerUserId,
      orderLineId: line.id,
      reason: 'First attempt',
      ipAddress: null,
    });

    await expect(
      ctx.requestReturnUseCase.execute({
        userId: buyerUserId,
        orderLineId: line.id,
        reason: 'Second attempt',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReturnAlreadyExistsError);
  });
});
