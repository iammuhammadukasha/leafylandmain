import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from '../../domain/repositories/order.repository';
import {
  PRODUCT_LOOKUP_REPOSITORY,
  type ProductLookupRepository,
} from '../../domain/repositories/product-lookup.repository';
import {
  WEBHOOK_SIGNATURE_VERIFIER,
  type WebhookSignatureVerifierPort,
} from '../ports/payment-gateway.port';
import {
  InvalidWebhookSignatureError,
  OrderNotFoundError,
} from '../../domain/errors/order.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface ProcessRazorpayWebhookInput {
  rawBody: string;
  signatureHeader: string | undefined;
  /** Parsed payload (the interface layer parses `rawBody` as JSON after
   * signature verification passes — the use case receives both the raw
   * string, which is what must be verified, and the pre-parsed shape, so
   * this use case never has to worry about parsing itself failing on a
   * request whose signature never even checked out). */
  payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
  };
  ipAddress: string | null;
}

export interface ProcessRazorpayWebhookResult {
  orderId: string;
  status: 'paid' | 'already_paid';
}

/**
 * POST /api/v1/orders/webhooks/razorpay (Public, signature-verified —
 * FR-ORD-003, BR-ORD-01). THE rule this whole slice exists to prove:
 *
 *   1. Verify `X-Razorpay-Signature` against the RAW request body using
 *      WebhookSignatureVerifierPort (real HMAC-SHA256, see
 *      infrastructure/payment/razorpay-webhook-signer.ts). Invalid
 *      signature -> InvalidWebhookSignatureError, mapped to 401 by the
 *      interface layer, and this method returns BEFORE touching the order
 *      repository or the product stock port at all — no state change of
 *      any kind on an unverified request.
 *   2. Only on a valid signature: look up the order by
 *      razorpayOrderId, set it to `paid` (Order.markPaid — the ONLY
 *      domain method that can do this), and decrement stock on each line's
 *      variant via ProductLookupRepository.decrementStock (Orders' narrow
 *      cross-context write port into Product, see that port's doc
 *      comment).
 *
 * IDEMPOTENCY DECISION (task: "decide and verify sensible idempotent
 * behavior"): if the order is already `paid` when a (validly-signed)
 * webhook for the same razorpayOrderId arrives again (Razorpay's own docs
 * say webhooks may be retried/redelivered), this method is a no-op that
 * returns `{ status: 'already_paid' }` without re-decrementing stock or
 * touching paidAt again. This is deliberately NOT an error (a 2xx
 * idempotent response is exactly what a webhook retry sender wants) —
 * only a genuinely bad signature is rejected.
 */
@Injectable()
export class ProcessRazorpayWebhookUseCase {
  private readonly logger = new Logger(ProcessRazorpayWebhookUseCase.name);

  constructor(
    @Inject(ORDER_REPOSITORY) private readonly orders: OrderRepository,
    @Inject(PRODUCT_LOOKUP_REPOSITORY)
    private readonly productLookup: ProductLookupRepository,
    @Inject(WEBHOOK_SIGNATURE_VERIFIER)
    private readonly signatureVerifier: WebhookSignatureVerifierPort,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(
    input: ProcessRazorpayWebhookInput,
  ): Promise<ProcessRazorpayWebhookResult> {
    const signatureValid = this.signatureVerifier.verify(
      input.rawBody,
      input.signatureHeader,
    );

    if (!signatureValid) {
      this.logger.warn(
        `Rejected Razorpay webhook with invalid signature (ip=${input.ipAddress ?? 'unknown'})`,
      );
      await this.auditLogger.record({
        actorUserId: null,
        action: 'order.webhook_signature_invalid',
        targetType: 'order',
        targetId: input.payload.razorpayOrderId,
        ipAddress: input.ipAddress,
      });
      throw new InvalidWebhookSignatureError();
    }

    const order = await this.orders.findByRazorpayOrderId(
      input.payload.razorpayOrderId,
    );
    if (!order) {
      throw new OrderNotFoundError();
    }

    if (order.status === 'paid') {
      return { orderId: order.id, status: 'already_paid' };
    }

    const now = new Date();
    order.markPaid(input.payload.razorpayPaymentId, now);
    await this.orders.save(order);

    for (const line of order.lines) {
      await this.productLookup.decrementStock(
        line.productVariantId,
        line.quantity,
      );
    }

    await this.auditLogger.record({
      actorUserId: null,
      action: 'order.paid',
      targetType: 'order',
      targetId: order.id,
      diff: { razorpayPaymentId: input.payload.razorpayPaymentId },
      ipAddress: input.ipAddress,
    });

    return { orderId: order.id, status: 'paid' };
  }
}
