/**
 * Port for the Razorpay payment gateway integration (FR-ORD-003). Same
 * "port in application/, stub adapter in infrastructure/" pattern as
 * Identity's `EmailSender` (`email-sender.port.ts` +
 * `ConsoleEmailSender`) — see `infrastructure/payment/stub-razorpay-gateway.ts`
 * for the stub implementation used in this slice, and
 * `infrastructure/payment/razorpay-webhook-signer.ts` for the real
 * HMAC-SHA256 signing/verification logic (the one part of this port that
 * must be genuinely correct, since it proves BR-ORD-01).
 */
export interface CreateGatewayOrderInput {
  amountMinor: bigint;
  currency: string;
  /** Used by a real adapter as the Razorpay "receipt" field — a merchant
   * reference id, here the platform order id. */
  receiptId: string;
}

export interface CreateGatewayOrderResult {
  gatewayOrderId: string;
}

/** FR-ORD-005 — input to the refund call ApproveReturnUseCase makes once a
 * return is approved. `paymentId` is the order's `razorpayPaymentId`
 * (captured from the verified webhook, BR-ORD-01) — a real adapter would
 * pass this as Razorpay's `payment_id` path param on `POST
 * /v1/payments/:id/refund`. `amountMinor` is the specific order line's
 * amount being refunded (unitPriceMinor * quantity + taxMinor), not the
 * whole order's total — this slice always refunds a full line, partial-line
 * refunds are out of scope. */
export interface RefundInput {
  paymentId: string;
  amountMinor: bigint;
}

export interface RefundResult {
  refundId: string;
}

export interface PaymentGatewayPort {
  createOrder(
    input: CreateGatewayOrderInput,
  ): Promise<CreateGatewayOrderResult>;
  /** FR-ORD-005 — issues a refund against a previously captured payment.
   * See `stub-razorpay-gateway.ts` for the stub implementation used in this
   * slice (no real Razorpay API call, same pattern as `createOrder`). */
  refund(input: RefundInput): Promise<RefundResult>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/**
 * Port for verifying an inbound Razorpay webhook's HMAC-SHA256 signature
 * (BR-ORD-01). Kept as a separate, narrower port from PaymentGatewayPort
 * (single-responsibility — "create an order" vs "verify a webhook" are
 * different capabilities a real Razorpay SDK also splits into different
 * concerns) so the webhook signature check can be unit tested and injected
 * independently of the order-creation stub.
 */
export interface WebhookSignatureVerifierPort {
  /** Returns true iff `signatureHeader` is the correct HMAC-SHA256(rawBody,
   * secret) hex digest, using a constant-time comparison (timing-attack
   * resistant, matches how Razorpay's own docs specify verification). */
  verify(rawBody: string, signatureHeader: string | undefined): boolean;
}

export const WEBHOOK_SIGNATURE_VERIFIER = Symbol('WEBHOOK_SIGNATURE_VERIFIER');
