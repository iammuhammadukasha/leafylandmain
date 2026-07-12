import { randomUUID } from 'node:crypto';
import { ApproveReturnUseCase } from '../approve-return.use-case';
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
import {
  FakeAuditLogger,
  FakeOrdersUserRolesRepository,
  FakeOrdersVendorLookupRepository,
  FakePaymentGateway,
} from '../../__tests__/fakes/fake-ports';
import {
  ReturnForbiddenError,
  ReturnNotRequestedError,
} from '../../../domain/errors/order.errors';

function buildUseCases() {
  const orders = new InMemoryOrderRepository();
  const shipments = new InMemoryShipmentRepository();
  const returns = new InMemoryReturnRepository();
  const vendorLookup = new FakeOrdersVendorLookupRepository();
  const userRoles = new FakeOrdersUserRolesRepository();
  const paymentGateway = new FakePaymentGateway();
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
  const approveReturnUseCase = new ApproveReturnUseCase(
    orders,
    returns,
    vendorLookup,
    userRoles,
    paymentGateway,
    auditLogger,
  );

  return {
    shipUseCase,
    deliverUseCase,
    requestReturnUseCase,
    approveReturnUseCase,
    orders,
    shipments,
    returns,
    vendorLookup,
    userRoles,
    paymentGateway,
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

/** Full chain: paid order -> ship -> deliver -> request return, returns the
 * ids needed to drive approve/reject. */
async function setUpRequestedReturn(ctx: ReturnType<typeof buildUseCases>) {
  const buyerUserId = 'buyer-1';
  const vendorId = randomUUID();
  const vendorOwnerId = 'vendor-owner-1';
  ctx.vendorLookup.seed({ id: vendorId, ownerUserId: vendorOwnerId });

  const line = buildLine({ vendorId });
  const order = Order.create({
    id: randomUUID(),
    userId: buyerUserId,
    shippingAddressId: randomUUID(),
    billingAddressId: randomUUID(),
    subtotalMinor: 10000n,
    taxMinor: 500n,
    shippingMinor: 0n,
    totalMinor: 10500n,
    lines: [line],
    now: new Date(),
  });
  order.markPaid('pay_test123', new Date());
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

  const returnEntity = await ctx.requestReturnUseCase.execute({
    userId: buyerUserId,
    orderLineId: line.id,
    reason: 'Defective item',
    ipAddress: null,
  });

  return { buyerUserId, vendorId, vendorOwnerId, line, order, returnEntity };
}

describe('ApproveReturnUseCase', () => {
  it('approves as the owning vendor: Return ends refunded, order line ends refunded, refund id recorded', async () => {
    const ctx = buildUseCases();
    const { vendorOwnerId, line, order, returnEntity } =
      await setUpRequestedReturn(ctx);

    const result = await ctx.approveReturnUseCase.execute({
      actorUserId: vendorOwnerId,
      returnId: returnEntity.id,
      ipAddress: '127.0.0.1',
    });

    expect(result.status).toBe('refunded');
    expect(result.refundId).toBe(ctx.paymentGateway.nextRefundId);
    expect(result.resolvedBy).toBe(vendorOwnerId);

    const persistedOrder = await ctx.orders.findById(order.id);
    const persistedLine = persistedOrder?.lines.find((l) => l.id === line.id);
    expect(persistedLine?.status).toBe('refunded');

    expect(ctx.paymentGateway.refundCalls).toHaveLength(1);
    expect(ctx.paymentGateway.refundCalls[0]?.paymentId).toBe('pay_test123');
    expect(ctx.paymentGateway.refundCalls[0]?.amountMinor).toBe(
      line.unitPriceMinor + line.taxMinor,
    );
  });

  it('rejects with ReturnForbiddenError when a DIFFERENT vendor (not the owner) tries to approve', async () => {
    const ctx = buildUseCases();
    const { returnEntity } = await setUpRequestedReturn(ctx);

    const attackerVendorOwnerId = 'vendor-owner-attacker';
    ctx.vendorLookup.seed({
      id: randomUUID(),
      ownerUserId: attackerVendorOwnerId,
    });

    await expect(
      ctx.approveReturnUseCase.execute({
        actorUserId: attackerVendorOwnerId,
        returnId: returnEntity.id,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReturnForbiddenError);

    // No refund should have been attempted.
    expect(ctx.paymentGateway.refundCalls).toHaveLength(0);
  });

  it('allows an admin to approve independent of vendor ownership', async () => {
    const ctx = buildUseCases();
    const { returnEntity } = await setUpRequestedReturn(ctx);

    const adminUserId = 'admin-1';
    ctx.userRoles.grantAdmin(adminUserId);

    const result = await ctx.approveReturnUseCase.execute({
      actorUserId: adminUserId,
      returnId: returnEntity.id,
      ipAddress: null,
    });

    expect(result.status).toBe('refunded');
    expect(result.resolvedBy).toBe(adminUserId);
  });

  it('rejects with ReturnNotRequestedError on a SECOND approve call (already refunded)', async () => {
    const ctx = buildUseCases();
    const { vendorOwnerId, returnEntity } = await setUpRequestedReturn(ctx);

    await ctx.approveReturnUseCase.execute({
      actorUserId: vendorOwnerId,
      returnId: returnEntity.id,
      ipAddress: null,
    });

    await expect(
      ctx.approveReturnUseCase.execute({
        actorUserId: vendorOwnerId,
        returnId: returnEntity.id,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ReturnNotRequestedError);
  });
});
