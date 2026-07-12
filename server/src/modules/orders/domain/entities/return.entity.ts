// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `returns` (Volume 04 §6, FR-ORD-005).
//
// STATE MACHINE (Volume 02 §6.2): requested -> approved/rejected ->
// refunded. This slice collapses the vendor/admin-facing "approve" API call
// into a single transaction that runs BOTH transitions server-side
// (requested -> approved, then immediately approved -> refunded once the
// stub gateway's refund() call returns) — see ApproveReturnUseCase's doc
// comment for why `approved` is still asserted as a real intermediate state
// on this entity (not skipped straight to `refunded`) even though only one
// user-facing endpoint exists for it. `rejected` is a terminal state reached
// directly from `requested` and never proceeds to `refunded`.

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'refunded';

export interface ReturnProps {
  id: string;
  orderLineId: string;
  reason: string;
  status: ReturnStatus;
  resolvedBy: string | null;
  refundId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class Return {
  private constructor(private props: ReturnProps) {}

  static reconstitute(props: ReturnProps): Return {
    return new Return(props);
  }

  /** POST /lines/:orderLineId/return (FR-ORD-005). Always created in
   * `requested` — only RequestReturnUseCase calls this, after it has
   * already verified ownership, fulfilled-line eligibility, and the 7-day
   * window (see that use case's doc comment). */
  static request(params: {
    id: string;
    orderLineId: string;
    reason: string;
    now: Date;
  }): Return {
    return new Return({
      id: params.id,
      orderLineId: params.orderLineId,
      reason: params.reason,
      status: 'requested',
      resolvedBy: null,
      refundId: null,
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get orderLineId(): string {
    return this.props.orderLineId;
  }

  get status(): ReturnStatus {
    return this.props.status;
  }

  get snapshot(): Readonly<ReturnProps> {
    return { ...this.props };
  }

  /** POST /returns/:id/approve, step 1 — `requested` -> `approved`. Asserted
   * as a domain invariant (throws if called from any other status) so a
   * caller can never approve an already-rejected or already-refunded
   * return, mirroring Shipment.markDelivered's "assert the precondition
   * again inside the entity" discipline. */
  approve(resolvedBy: string, now: Date): void {
    if (this.props.status !== 'requested') {
      throw new Error(
        `Cannot approve return ${this.props.id} from status ${this.props.status}.`,
      );
    }
    this.props.status = 'approved';
    this.props.resolvedBy = resolvedBy;
    this.props.updatedAt = now;
  }

  /** POST /returns/:id/approve, step 2 — `approved` -> `refunded`, called
   * immediately after `approve()` within the same use-case transaction once
   * the stub gateway's refund() call has returned a refund id. */
  markRefunded(refundId: string, now: Date): void {
    if (this.props.status !== 'approved') {
      throw new Error(
        `Cannot mark return ${this.props.id} refunded from status ${this.props.status}.`,
      );
    }
    this.props.status = 'refunded';
    this.props.refundId = refundId;
    this.props.updatedAt = now;
  }

  /** POST /returns/:id/reject — `requested` -> `rejected`, terminal. Does
   * NOT touch the order line's status (RejectReturnUseCase leaves the line
   * `fulfilled`, per FR-ORD-005's "a rejected return isn't a refund"). */
  reject(resolvedBy: string, now: Date): void {
    if (this.props.status !== 'requested') {
      throw new Error(
        `Cannot reject return ${this.props.id} from status ${this.props.status}.`,
      );
    }
    this.props.status = 'rejected';
    this.props.resolvedBy = resolvedBy;
    this.props.updatedAt = now;
  }
}
