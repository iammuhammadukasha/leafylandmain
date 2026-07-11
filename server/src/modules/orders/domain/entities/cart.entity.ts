// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `carts` + its `cart_lines` (Volume 04
// §6) in terms the domain cares about, not the DB's terms.
//
// DESIGN DECISION: CartLine is modeled as a plain value held inside the
// Cart aggregate (Cart is the aggregate root — cart_lines has no
// independent lifecycle worth its own repository, matching how Order owns
// OrderLine below). `cart_lines` is explicitly "no soft delete" per
// Volume 04 §6, so CartLineProps carries no deletedAt/version.

export type CartStatus = 'active' | 'converted' | 'abandoned';

export interface CartLineProps {
  id: string;
  productVariantId: string;
  quantity: number;
}

export interface CartProps {
  id: string;
  userId: string;
  status: CartStatus;
  lines: CartLineProps[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class Cart {
  private constructor(private props: CartProps) {}

  static reconstitute(props: CartProps): Cart {
    return new Cart(props);
  }

  /** Factory for a brand-new empty active cart (FR-ORD-001, Auth-only
   * scope for this slice — one active cart per user, looked up/created
   * lazily by GetOrCreateActiveCart-style use cases). */
  static create(params: { id: string; userId: string; now: Date }): Cart {
    return new Cart({
      id: params.id,
      userId: params.userId,
      status: 'active',
      lines: [],
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

  get status(): CartStatus {
    return this.props.status;
  }

  get lines(): readonly CartLineProps[] {
    return this.props.lines;
  }

  get snapshot(): Readonly<CartProps> {
    return { ...this.props, lines: [...this.props.lines] };
  }

  /** Adds a new line or increments an existing line's quantity for the
   * same variant (FR-ORD-001, "adds/increments a line"). Caller
   * (application layer) is responsible for the cross-context check that
   * the variant exists and belongs to an active product BEFORE calling
   * this — the entity has no way to reach Product's data itself. */
  addOrIncrementLine(params: {
    lineId: string;
    productVariantId: string;
    quantity: number;
    now: Date;
  }): void {
    const existing = this.props.lines.find(
      (line) => line.productVariantId === params.productVariantId,
    );
    if (existing) {
      existing.quantity += params.quantity;
    } else {
      this.props.lines.push({
        id: params.lineId,
        productVariantId: params.productVariantId,
        quantity: params.quantity,
      });
    }
    this.props.updatedAt = params.now;
  }

  /** PATCH /cart/lines/:variantId — sets an existing line's quantity to an
   * exact value. Throws if the line doesn't exist; caller maps to
   * CartLineNotFoundError-style domain error via a check before calling,
   * or this could be surfaced as a boolean return — kept explicit here so
   * the use case doesn't need to duplicate the "does this line exist"
   * check. */
  updateLineQuantity(params: {
    productVariantId: string;
    quantity: number;
    now: Date;
  }): boolean {
    const existing = this.props.lines.find(
      (line) => line.productVariantId === params.productVariantId,
    );
    if (!existing) {
      return false;
    }
    existing.quantity = params.quantity;
    this.props.updatedAt = params.now;
    return true;
  }

  removeLine(productVariantId: string, now: Date): boolean {
    const before = this.props.lines.length;
    this.props.lines = this.props.lines.filter(
      (line) => line.productVariantId !== productVariantId,
    );
    const removed = this.props.lines.length !== before;
    if (removed) {
      this.props.updatedAt = now;
    }
    return removed;
  }

  /** Cart -> Order conversion at checkout (FR-ORD-002). Marks the cart
   * `converted` so a fresh `active` cart is created for the user's next
   * shopping session (mirrors Volume 04 §6 `carts.status` enum). */
  convert(now: Date): void {
    this.props.status = 'converted';
    this.props.updatedAt = now;
  }
}
