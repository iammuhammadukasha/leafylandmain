import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateGatewayOrderInput,
  CreateGatewayOrderResult,
  PaymentGatewayPort,
  RefundInput,
  RefundResult,
} from '../../application/ports/payment-gateway.port';

/**
 * STUB Razorpay gateway adapter (FR-ORD-003). `createOrder` just generates
 * a fake gateway order id locally — no real Razorpay API call is made, no
 * API keys are read. Same "stub adapter, doc comment says what a real
 * implementation would replace it" pattern as Identity's
 * `ConsoleEmailSender` (`infrastructure/email/console-email-sender.ts`).
 *
 * A real adapter would implement this same PaymentGatewayPort interface by
 * calling Razorpay's `orders.create` REST API
 * (POST https://api.razorpay.com/v1/orders) with the merchant's real
 * key_id/key_secret, and would swap in here via the module's provider
 * binding (`{ provide: PAYMENT_GATEWAY, useClass: RazorpayGateway }`)
 * without touching any application-layer code — CheckoutUseCase only
 * depends on the PaymentGatewayPort interface, never this class directly.
 *
 * The fake id is prefixed `order_stub_` so it's visually obvious in logs/DB
 * that no real payment infrastructure was involved (mirrors Razorpay's own
 * real id format of `order_<random>` closely enough for the webhook
 * round-trip to look realistic in tests/demos).
 */
@Injectable()
export class StubRazorpayGateway implements PaymentGatewayPort {
  private readonly logger = new Logger(StubRazorpayGateway.name);

  createOrder(
    input: CreateGatewayOrderInput,
  ): Promise<CreateGatewayOrderResult> {
    const gatewayOrderId = `order_stub_${randomUUID().replace(/-/g, '')}`;
    this.logger.log(
      `[stub gateway] Created fake Razorpay order ${gatewayOrderId} for receipt=${input.receiptId} amount=${input.amountMinor}${input.currency}`,
    );
    return Promise.resolve({ gatewayOrderId });
  }

  /**
   * STUB refund (FR-ORD-005). Same "generate a fake id locally, no real API
   * call" pattern as `createOrder` above — a real adapter would call
   * Razorpay's `payments.refund` REST API (POST
   * https://api.razorpay.com/v1/payments/:id/refund) with the real
   * key_id/key_secret, and would swap in via the same PAYMENT_GATEWAY
   * provider binding without ApproveReturnUseCase (the only caller) ever
   * knowing the difference — it depends only on PaymentGatewayPort.
   *
   * The fake id is prefixed `rfnd_stub_`, mirroring Razorpay's own real
   * refund id format of `rfnd_<random>` closely enough to look realistic in
   * logs/DB, same visual-marker intent as `order_stub_` above.
   */
  refund(input: RefundInput): Promise<RefundResult> {
    const refundId = `rfnd_stub_${randomUUID().replace(/-/g, '')}`;
    this.logger.log(
      `[stub gateway] Issued fake Razorpay refund ${refundId} for paymentId=${input.paymentId} amount=${input.amountMinor}`,
    );
    return Promise.resolve({ refundId });
  }
}
