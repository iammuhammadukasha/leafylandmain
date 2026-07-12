// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `shipments` (Volume 04 §6, FR-ORD-006).
//
// GROUPING DECISION (task brief: "one shipment per vendor per order... if
// multiple lines from the same vendor exist on the same order, they likely
// share one shipment; use your judgment on the exact grouping but document
// the decision"): a Shipment is keyed by (orderId, vendorId) — enforced by
// a DB unique constraint (`@@unique([orderId, vendorId])` in schema.prisma)
// — and covers EVERY order_line belonging to that vendor on that order, not
// just the single order line the vendor happened to call /ship on. This
// matches the ERD's own note verbatim ("one shipment per vendor per
// order") and the real-world shape of the problem: a vendor packs and
// ships all their items in one order together, they don't create a
// separate parcel/tracking number per SKU. Practically: ShipOrderLineUseCase
// resolves the calling order line to its (orderId, vendorId) pair, then
// upserts ONE Shipment for that pair; DeliverShipmentUseCase transitions
// that one Shipment to delivered and, as a consequence, ALL of that
// vendor's order_lines on that order to `fulfilled` in the same
// transaction (not just the one line named in the URL) — see that
// use case's doc comment.

export type ShipmentStatus = 'pending' | 'shipped' | 'delivered';

export interface ShipmentProps {
  id: string;
  orderId: string;
  vendorId: string;
  carrier: string | null;
  trackingNumber: string | null;
  status: ShipmentStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class Shipment {
  private constructor(private props: ShipmentProps) {}

  static reconstitute(props: ShipmentProps): Shipment {
    return new Shipment(props);
  }

  /** POST .../ship, first call for this (orderId, vendorId) pair — creates
   * the shipment already in `shipped` status (there is no meaningful
   * separate "create in pending, then ship" step in this slice: the vendor
   * calls /ship exactly when they've physically shipped the parcel). */
  static createShipped(params: {
    id: string;
    orderId: string;
    vendorId: string;
    carrier: string;
    trackingNumber: string;
    now: Date;
  }): Shipment {
    return new Shipment({
      id: params.id,
      orderId: params.orderId,
      vendorId: params.vendorId,
      carrier: params.carrier,
      trackingNumber: params.trackingNumber,
      status: 'shipped',
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get orderId(): string {
    return this.props.orderId;
  }

  get vendorId(): string {
    return this.props.vendorId;
  }

  get status(): ShipmentStatus {
    return this.props.status;
  }

  get snapshot(): Readonly<ShipmentProps> {
    return { ...this.props };
  }

  /** POST .../ship, subsequent call for an already-existing shipment on
   * this (orderId, vendorId) pair — re-ships/updates carrier+tracking
   * (e.g., vendor corrects a typo'd tracking number). Idempotent: calling
   * this on an already-`shipped` shipment just refreshes carrier/tracking,
   * no error — updating shipment details isn't a state-machine violation
   * the way shipping-before-paid or delivering-before-shipping are. */
  reship(carrier: string, trackingNumber: string, now: Date): void {
    this.props.carrier = carrier;
    this.props.trackingNumber = trackingNumber;
    this.props.status = 'shipped';
    this.props.updatedAt = now;
  }

  /** POST .../deliver — THE state-machine ordering rule this slice exists
   * to prove: only callable when the shipment is currently `shipped`
   * (never `pending`/already-`delivered`). The interface layer/use case is
   * responsible for rejecting with ShipmentNotShippedError BEFORE calling
   * this if that precondition isn't met — this method asserts it again as
   * a domain invariant so the entity itself never silently accepts an
   * invalid transition even if a future caller forgets the use-case-level
   * check. */
  markDelivered(now: Date): void {
    if (this.props.status !== 'shipped') {
      throw new Error(
        `Cannot mark shipment ${this.props.id} delivered from status ${this.props.status}.`,
      );
    }
    this.props.status = 'delivered';
    this.props.updatedAt = now;
  }
}
