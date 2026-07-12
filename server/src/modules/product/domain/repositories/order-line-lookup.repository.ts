/**
 * Domain-owned port for the narrow order-line facts the Reviews use case
 * needs (FR-PRD-004: a buyer may review a product only if they have a
 * qualifying order line for it — BRS §7 rule 4, "verified buyer only").
 * `order_lines`/`orders` are Orders-context tables (Volume 04 §6), but per
 * the Architecture §3 cross-context rule ("a module never queries another
 * module's database tables directly... Prisma schemas are organized so
 * each module's models are only injected into that module's
 * repositories"), Product gets its OWN thin, read-only repository over
 * those tables for the one query it needs — same pattern as Orders' own
 * `ProductLookupRepository` reading Product's `product_variants` table
 * (the exact reverse direction of this same discipline), and as Product's
 * existing `VendorLookupRepository`/`VendorDocumentLookupRepository`.
 *
 * DESIGN DECISION (read this before touching SubmitReviewUseCase): this
 * port surfaces BOTH `orderStatus` (the containing order's payment status,
 * BR-ORD-01) and `lineStatus` (the order_line's own fulfillment status,
 * FR-ORD-006). Historically (before FR-ORD-006 existed) this port only
 * exposed `orderStatus` and SubmitReviewUseCase gated eligibility on
 * `orderStatus === 'paid'` as a DOCUMENTED DEVIATION from the API spec's
 * literal "fulfilled" wording, because `order_lines.status` never advanced
 * past `pending` in this system (no shipment/delivery flow existed to
 * drive it there). FR-ORD-006 now ships DeliverShipmentUseCase, which DOES
 * advance a line to `fulfilled` on delivery — so `lineStatus` is now a
 * real, reachable signal, and SubmitReviewUseCase has been updated to gate
 * on `lineStatus === 'fulfilled'` (closing that deviation), keeping
 * `orderStatus` on this port for potential future use / other callers
 * rather than removing it.
 */
export interface OrderLineSummary {
  id: string;
  orderId: string;
  orderUserId: string;
  productVariantId: string;
  orderStatus:
    | 'pending_payment'
    | 'paid'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded';
  lineStatus: 'pending' | 'fulfilled' | 'returned' | 'refunded';
}

export interface OrderLineLookupRepository {
  findById(id: string): Promise<OrderLineSummary | null>;
}

export const ORDER_LINE_LOOKUP_REPOSITORY = Symbol(
  'ORDER_LINE_LOOKUP_REPOSITORY',
);
