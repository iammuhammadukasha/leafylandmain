/**
 * Domain-owned READ port for GET /api/v1/vendors/me/orders (FR-ORD-006).
 * Deliberately separate from OrderRepository: that port is aggregate-
 * shaped (load one Order + all its lines, to mutate it) while this one is
 * a flat, paginated, cross-order query — "every order_line belonging to
 * vendor X, across every buyer's order, joined with its shipment status if
 * one exists." Modeling this as its own read-only view port (rather than
 * bolting a `findLinesByVendorId` onto OrderRepository) keeps
 * OrderRepository's contract aggregate-oriented and matches Constitution
 * §6's CQRS guidance ("only where reads and writes genuinely diverge") —
 * this is exactly that divergence: the write side operates on one Order
 * aggregate at a time, the read side spans many.
 */
export interface VendorOrderLineView {
  orderLineId: string;
  orderId: string;
  productVariantId: string;
  quantity: number;
  unitPriceMinor: bigint;
  lineStatus: 'pending' | 'fulfilled' | 'returned' | 'refunded';
  shipmentStatus: 'pending' | 'shipped' | 'delivered' | null;
  createdAt: Date;
  /** FR-ORD-005 addition — the return row against this line, if any (a
   * line has at most one, Return.orderLineId is DB-unique). Lets the
   * vendor-orders UI surface an approve/reject action without a separate
   * round trip or a new endpoint (no GET /returns list exists in the API
   * spec, §6.4 only defines the three action endpoints). Null when no
   * return has ever been requested against this line. */
  returnId: string | null;
  returnStatus: 'requested' | 'approved' | 'rejected' | 'refunded' | null;
}

export interface VendorOrderLinePage {
  items: VendorOrderLineView[];
  total: number;
}

export interface VendorOrderLineViewRepository {
  findByVendorId(
    vendorId: string,
    page: number,
    pageSize: number,
  ): Promise<VendorOrderLinePage>;
}

export const VENDOR_ORDER_LINE_VIEW_REPOSITORY = Symbol(
  'VENDOR_ORDER_LINE_VIEW_REPOSITORY',
);
