/**
 * Domain-level error types. These carry no HTTP concerns (no status
 * codes) — the interface layer maps them to AppException with the right
 * HTTP status + error code from the API spec taxonomy. Mirrors Product's
 * `product.errors.ts` / Vendor's `vendor.errors.ts` pattern.
 */

export class CartLineNotFoundError extends Error {
  constructor() {
    super('Cart line not found.');
    this.name = 'CartLineNotFoundError';
  }
}

/** FR-ORD-001 — POST /cart/lines must confirm the variant exists and
 * belongs to an `active` product before adding it. */
export class ProductVariantNotAvailableError extends Error {
  constructor(
    message = 'This product is not currently available for purchase.',
  ) {
    super(message);
    this.name = 'ProductVariantNotAvailableError';
  }
}

/** API Spec §6, module error code CART_EMPTY — checkout/quote on an empty
 * cart. */
export class CartEmptyError extends Error {
  constructor() {
    super('Your cart is empty.');
    this.name = 'CartEmptyError';
  }
}

/** API Spec §6, module error code OUT_OF_STOCK — re-validated at
 * quote/checkout time (FR-ORD-001 "validates stock and price at checkout
 * time, not just at add-time"). */
export class OutOfStockError extends Error {
  constructor(sku?: string) {
    super(
      sku
        ? `Insufficient stock for SKU ${sku}.`
        : 'One or more items in your cart are out of stock.',
    );
    this.name = 'OutOfStockError';
  }
}

export class AddressNotFoundError extends Error {
  constructor(message = 'Address not found.') {
    super(message);
    this.name = 'AddressNotFoundError';
  }
}

/** Address exists but does not belong to the calling user — never
 * leaked as a distinct error to the client (mapped to the same 404 as
 * AddressNotFoundError by the interface layer, no-leak pattern). */
export class AddressForbiddenError extends Error {
  constructor() {
    super('Address does not belong to the caller.');
    this.name = 'AddressForbiddenError';
  }
}

export class OrderNotFoundError extends Error {
  constructor() {
    super('Order not found.');
    this.name = 'OrderNotFoundError';
  }
}

export class OrderForbiddenError extends Error {
  constructor(message = 'You are not authorized to view this order.') {
    super(message);
    this.name = 'OrderForbiddenError';
  }
}

/** API Spec §6, module error code ORDER_ALREADY_PAID — defensive guard,
 * not currently reachable from any endpoint that re-runs checkout on an
 * already-paid order, but kept for the webhook idempotency path's
 * internal use (see ProcessRazorpayWebhookUseCase doc comment). */
export class OrderAlreadyPaidError extends Error {
  constructor() {
    super('This order has already been paid.');
    this.name = 'OrderAlreadyPaidError';
  }
}

/** BR-ORD-01 — API Spec §6 module error code INVALID_WEBHOOK_SIGNATURE.
 * Thrown when the HMAC-SHA256 signature on a Razorpay webhook payload
 * does not match the shared secret. The interface layer maps this to 401
 * and the handler must NOT change any order state when this is thrown. */
export class InvalidWebhookSignatureError extends Error {
  constructor() {
    super('Webhook signature verification failed.');
    this.name = 'InvalidWebhookSignatureError';
  }
}

// --- FR-ORD-006: vendor order fulfillment -------------------------------

/** GET/POST /vendors/me/orders/... — the order line does not exist at
 * all. Distinct from OrderLineForbiddenError (exists but not this
 * vendor's) so the interface layer can map "unknown id" to 404 while
 * still no-leaking ownership via a separate 403 — same split as
 * Order/OrderForbidden above. */
export class OrderLineNotFoundError extends Error {
  constructor() {
    super('Order line not found.');
    this.name = 'OrderLineNotFoundError';
  }
}

/** The order line exists but belongs to a different vendor than the
 * caller — FR-ID-006's "a vendor_staff token for Vendor A cannot read or
 * mutate Vendor B's resources" AC, applied to order fulfillment. Mapped
 * to 403 FORBIDDEN, never leaking whether the line exists for another
 * vendor (message is generic). */
export class OrderLineForbiddenError extends Error {
  constructor() {
    super('You are not authorized to act on this order line.');
    this.name = 'OrderLineForbiddenError';
  }
}

/** POST .../ship — API Spec §6 module error code ORDER_NOT_PAID. Only a
 * `paid` order's lines are shippable (FR-ORD-002: a pending_payment order
 * hasn't been paid for yet, nothing to fulfill). */
export class OrderNotPaidError extends Error {
  constructor() {
    super('This order has not been paid yet and cannot be shipped.');
    this.name = 'OrderNotPaidError';
  }
}

/** POST .../deliver — API Spec §6 module error code SHIPMENT_NOT_SHIPPED.
 * A shipment must exist and be in `shipped` status before it can be
 * marked `delivered` (state-machine ordering: ship must precede deliver).
 * Also covers "no shipment exists yet" (never shipped). */
export class ShipmentNotShippedError extends Error {
  constructor() {
    super(
      'This order line has not been shipped yet; ship it before marking it delivered.',
    );
    this.name = 'ShipmentNotShippedError';
  }
}

// --- FR-ORD-005: returns & refunds ---------------------------------------

/** POST /returns/:id/approve|reject — the return does not exist at all.
 * Distinct from ReturnForbiddenError, same 404-vs-403 no-leak split as
 * OrderLineNotFoundError/OrderLineForbiddenError above. */
export class ReturnNotFoundError extends Error {
  constructor() {
    super('Return not found.');
    this.name = 'ReturnNotFoundError';
  }
}

/** POST /returns/:id/approve|reject — the return exists but the caller is
 * neither the owning vendor (owner/staff) nor an admin. Mapped to 403
 * FORBIDDEN with a generic message, never leaking which vendor owns it. */
export class ReturnForbiddenError extends Error {
  constructor() {
    super('You are not authorized to act on this return.');
    this.name = 'ReturnForbiddenError';
  }
}

/** POST /returns/:id/approve|reject — the return exists but is not in
 * `requested` status (already approved/rejected/refunded). Approve/reject
 * are only valid on a freshly `requested` return — this is the
 * state-machine ordering guard, same discipline as
 * ShipmentNotShippedError. */
export class ReturnNotRequestedError extends Error {
  constructor() {
    super('This return has already been resolved.');
    this.name = 'ReturnNotRequestedError';
  }
}

/** POST /lines/:orderLineId/return — API Spec §6 module error code
 * RETURN_WINDOW_EXPIRED (§6.4). Thrown both when the line is not yet
 * `fulfilled` (nothing to return — a pending/non-existent-status line was
 * never delivered) and when the 7-day platform-wide window (task brief's
 * documented simplification, see schema.prisma's Return model doc comment)
 * has elapsed since delivery — both are "you can't return this right now"
 * business-rule violations, collapsed to the ONE error code the API spec
 * defines for this endpoint (no separate "ORDER_LINE_NOT_FULFILLED" code
 * exists in Volume 07 §6.4's literal table, and inventing one beyond what's
 * documented would violate Constitution §11.1 "do not invent requirements
 * or endpoints not documented" applied to error codes). The message
 * distinguishes the two cases for the caller even though the machine-
 * readable code is shared. */
export class ReturnWindowExpiredError extends Error {
  constructor(
    message = 'This order line is outside the return policy window.',
  ) {
    super(message);
    this.name = 'ReturnWindowExpiredError';
  }
}

/** POST /lines/:orderLineId/return — the order line does not belong to the
 * calling user. Same no-leak 404 pattern as AddressForbiddenError (the
 * interface layer maps this to the same 404 as "order line not found", not
 * a distinct 403, since a buyer has no legitimate reason to learn that an
 * order line id exists but belongs to someone else). */
export class OrderLineNotOwnedError extends Error {
  constructor() {
    super('Order line not found.');
    this.name = 'OrderLineNotOwnedError';
  }
}

/** POST /lines/:orderLineId/return — a return already exists for this order
 * line (Return.orderLineId is DB-unique, same "one per line" precedent as
 * Review.orderLineId, Volume 04 §5). Mapped to 409 CONFLICT — this is a
 * state conflict, not a validation or business-rule-window problem, so it
 * gets its own code distinct from RETURN_WINDOW_EXPIRED. */
export class ReturnAlreadyExistsError extends Error {
  constructor() {
    super('A return has already been requested for this order line.');
    this.name = 'ReturnAlreadyExistsError';
  }
}
