// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `orders` + its `order_lines` (Volume
// 04 §6) in terms the domain cares about, not the DB's terms.
//
// OrderLine is modeled as a value held inside the Order aggregate (Order
// is the aggregate root) — same "aggregate owns its lines" shape as
// Cart/CartLine above.

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type OrderLineStatus = 'pending' | 'fulfilled' | 'returned' | 'refunded';

export interface OrderLineProps {
  id: string;
  productVariantId: string;
  vendorId: string;
  quantity: number;
  unitPriceMinor: bigint;
  taxMinor: bigint;
  commissionBpsSnapshot: number | null;
  status: OrderLineStatus;
}

export interface OrderProps {
  id: string;
  userId: string;
  shippingAddressId: string;
  billingAddressId: string;
  status: OrderStatus;
  subtotalMinor: bigint;
  taxMinor: bigint;
  shippingMinor: bigint;
  totalMinor: bigint;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: Date | null;
  lines: OrderLineProps[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class Order {
  private constructor(private props: OrderProps) {}

  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  /** POST /checkout (FR-ORD-002). Always created in `pending_payment` —
   * `paid` is set ONLY via `markPaid`, which is only ever called from the
   * verified-webhook path (BR-ORD-01). Line totals/tax are computed by the
   * calling use case (re-running the same quote logic as
   * POST /checkout/quote) before this factory runs. */
  static create(params: {
    id: string;
    userId: string;
    shippingAddressId: string;
    billingAddressId: string;
    subtotalMinor: bigint;
    taxMinor: bigint;
    shippingMinor: bigint;
    totalMinor: bigint;
    lines: OrderLineProps[];
    now: Date;
  }): Order {
    return new Order({
      id: params.id,
      userId: params.userId,
      shippingAddressId: params.shippingAddressId,
      billingAddressId: params.billingAddressId,
      status: 'pending_payment',
      subtotalMinor: params.subtotalMinor,
      taxMinor: params.taxMinor,
      shippingMinor: params.shippingMinor,
      totalMinor: params.totalMinor,
      razorpayOrderId: null,
      razorpayPaymentId: null,
      paidAt: null,
      lines: params.lines,
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get totalMinor(): bigint {
    return this.props.totalMinor;
  }

  get lines(): readonly OrderLineProps[] {
    return this.props.lines;
  }

  get snapshot(): Readonly<OrderProps> {
    return { ...this.props, lines: this.props.lines.map((l) => ({ ...l })) };
  }

  /** Stores the stub gateway's order id right after creation, still
   * `pending_payment` (FR-ORD-002 — "creates a pending_payment order +
   * Razorpay payment order"). */
  attachGatewayOrderId(razorpayOrderId: string, now: Date): void {
    this.props.razorpayOrderId = razorpayOrderId;
    this.props.updatedAt = now;
  }

  /** BR-ORD-01 — THE rule this whole slice exists to prove: this is the
   * ONLY method that transitions an order to `paid`, and the interface
   * layer only calls it from the webhook handler after HMAC signature
   * verification has succeeded (never from a client-side "I paid"
   * callback). Idempotent by construction at the use-case level (see
   * ProcessRazorpayWebhookUseCase) — calling this twice on an
   * already-paid order is guarded there, not here, since "already paid"
   * is a use-case-level idempotency concern, not a domain invariant this
   * entity refuses to violate silently.
   */
  markPaid(razorpayPaymentId: string, now: Date): void {
    this.props.status = 'paid';
    this.props.razorpayPaymentId = razorpayPaymentId;
    this.props.paidAt = now;
    this.props.updatedAt = now;
  }
}
