import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Order, type OrderLineProps } from '../../domain/entities/order.entity';
import {
  CART_REPOSITORY,
  type CartRepository,
} from '../../domain/repositories/cart.repository';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository';
import {
  ADDRESS_LOOKUP_REPOSITORY,
  type AddressLookupRepository,
} from '../../domain/repositories/address-lookup.repository';
import {
  PAYMENT_GATEWAY,
  type PaymentGatewayPort,
} from '../ports/payment-gateway.port';
import {
  AddressForbiddenError,
  AddressNotFoundError,
  CartEmptyError,
} from '../../domain/errors/order.errors';
import { CartPricingService } from '../services/cart-pricing.service';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface CheckoutInput {
  userId: string;
  shippingAddressId: string;
  billingAddressId: string;
  ipAddress: string | null;
}

export interface CheckoutResult {
  orderId: string;
  gatewayOrderId: string;
  amountMinor: string;
}

/**
 * POST /api/v1/orders/checkout (Auth, FR-ORD-002). Re-runs the same
 * validation as quote (CartPricingService.quote — never trusts a stale
 * client-supplied quote), validates both addresses belong to the calling
 * user, creates the Order + OrderLines in a DB transaction with status
 * `pending_payment`, calls the stub payment gateway for a
 * `gatewayOrderId`, stores it, and converts the cart. Idempotency-Key
 * header support (API Spec §8) is NOT implemented in this slice — noted
 * as deferred; a real implementation would dedupe replayed checkout calls
 * by that header, out of scope here since no idempotency-key store exists
 * yet.
 */
@Injectable()
export class CheckoutUseCase {
  constructor(
    @Inject(CART_REPOSITORY) private readonly carts: CartRepository,
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(ADDRESS_LOOKUP_REPOSITORY)
    private readonly addressLookup: AddressLookupRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly paymentGateway: PaymentGatewayPort,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
    private readonly pricing: CartPricingService,
  ) {}

  async execute(input: CheckoutInput): Promise<CheckoutResult> {
    const cart = await this.carts.findActiveByUserId(input.userId);
    if (!cart) {
      throw new CartEmptyError();
    }

    await this.assertOwnedAddress(input.userId, input.shippingAddressId);
    await this.assertOwnedAddress(input.userId, input.billingAddressId);

    const quote = await this.pricing.quote(cart);

    const now = new Date();
    const orderLines: OrderLineProps[] = quote.lines.map((line) => ({
      id: randomUUID(),
      productVariantId: line.productVariantId,
      vendorId: line.vendorId,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      taxMinor: line.lineTaxMinor,
      commissionBpsSnapshot: null,
      status: 'pending',
    }));

    const order = Order.create({
      id: randomUUID(),
      userId: input.userId,
      shippingAddressId: input.shippingAddressId,
      billingAddressId: input.billingAddressId,
      subtotalMinor: quote.subtotalMinor,
      taxMinor: quote.taxMinor,
      shippingMinor: quote.shippingMinor,
      totalMinor: quote.totalMinor,
      lines: orderLines,
      now,
    });

    const { gatewayOrderId } = await this.paymentGateway.createOrder({
      amountMinor: quote.totalMinor,
      currency: 'INR',
      receiptId: order.id,
    });
    order.attachGatewayOrderId(gatewayOrderId, now);

    cart.convert(now);

    // Order + lines committed together, and the cart flipped to
    // `converted` in the same transaction (OrderRepository.save handles
    // the order+lines write atomically — see PrismaOrderRepository).
    await this.orders.save(order);
    await this.carts.save(cart);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'order.placed',
      targetType: 'order',
      targetId: order.id,
      diff: { totalMinor: quote.totalMinor.toString(), gatewayOrderId },
      ipAddress: input.ipAddress,
    });

    return {
      orderId: order.id,
      gatewayOrderId,
      amountMinor: quote.totalMinor.toString(),
    };
  }

  private async assertOwnedAddress(
    userId: string,
    addressId: string,
  ): Promise<void> {
    const address = await this.addressLookup.findById(addressId);
    if (!address) {
      throw new AddressNotFoundError();
    }
    if (address.userId !== userId) {
      throw new AddressForbiddenError();
    }
  }
}
