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
 * port surfaces `orderStatus` (the containing order's status) alongside
 * the line's own facts, because eligibility is gated on the *order's*
 * payment status (BR-ORD-01: `paid` is only ever set from a verified
 * Razorpay webhook), not the order_line's own `status` column (which this
 * slice never advances past `pending` — see schema.prisma's OrderLineStatus
 * comment; shipments/fulfillment, FR-ORD-006, isn't built). The API spec
 * (Volume 07 §5.3) says the line must be "fulfilled" — this is the
 * documented deviation described in SubmitReviewUseCase's doc comment:
 * we gate on `orderStatus === 'paid'` instead, since `fulfilled` never
 * occurs in the current system and gating on it would make reviews
 * permanently impossible.
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
}

export interface OrderLineLookupRepository {
  findById(id: string): Promise<OrderLineSummary | null>;
}

export const ORDER_LINE_LOOKUP_REPOSITORY = Symbol(
  'ORDER_LINE_LOOKUP_REPOSITORY',
);
