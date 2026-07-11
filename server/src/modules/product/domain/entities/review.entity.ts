// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `reviews` (Volume 04 §5) in terms the
// domain cares about, not the DB's terms.

export interface ReviewProps {
  id: string;
  productId: string;
  userId: string;
  orderLineId: string;
  rating: number;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class Review {
  private constructor(private props: ReviewProps) {}

  static reconstitute(props: ReviewProps): Review {
    return new Review(props);
  }

  /** Factory for a new review (FR-PRD-004). Eligibility (verified-buyer-
   * only, BRS §7 rule 4) is checked entirely by the calling use case BEFORE
   * this factory runs — it needs a cross-context read of the order line via
   * OrderLineLookupRepository, which is an application-layer concern, not
   * something a domain entity can reach for itself. This factory only
   * enforces the one invariant it CAN enforce locally: rating is 1-5. */
  static create(params: {
    id: string;
    productId: string;
    userId: string;
    orderLineId: string;
    rating: number;
    body: string;
    now: Date;
  }): Review {
    if (
      !Number.isInteger(params.rating) ||
      params.rating < 1 ||
      params.rating > 5
    ) {
      throw new RangeError('rating must be an integer between 1 and 5.');
    }
    return new Review({
      id: params.id,
      productId: params.productId,
      userId: params.userId,
      orderLineId: params.orderLineId,
      rating: params.rating,
      body: params.body,
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get productId(): string {
    return this.props.productId;
  }

  get orderLineId(): string {
    return this.props.orderLineId;
  }

  get snapshot(): Readonly<ReviewProps> {
    return { ...this.props };
  }
}
