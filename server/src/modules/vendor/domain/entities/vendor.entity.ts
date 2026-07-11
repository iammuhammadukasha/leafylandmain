// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `vendors` (Volume 04 §4) in terms the
// domain cares about, not the DB's terms.

export type VendorStatus = 'pending' | 'verified' | 'rejected' | 'revoked';

export interface VendorProps {
  id: string;
  ownerUserId: string;
  businessName: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  status: VendorStatus;
  commissionRateBps: number | null;
  verifiedAt: Date | null;
  rejectedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class Vendor {
  private constructor(private props: VendorProps) {}

  static reconstitute(props: VendorProps): Vendor {
    return new Vendor(props);
  }

  /** Factory for a brand-new vendor registration (FR-VND-001). Always
   * starts in `pending` status — verification (FR-VND-002) is a separate
   * admin-reviewed transition, never set at registration time. */
  static register(params: {
    id: string;
    ownerUserId: string;
    businessName: string;
    description: string | null;
    now: Date;
  }): Vendor {
    return new Vendor({
      id: params.id,
      ownerUserId: params.ownerUserId,
      businessName: params.businessName,
      description: params.description,
      logoUrl: null,
      bannerUrl: null,
      status: 'pending',
      commissionRateBps: null,
      verifiedAt: null,
      rejectedReason: null,
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get ownerUserId(): string {
    return this.props.ownerUserId;
  }

  get businessName(): string {
    return this.props.businessName;
  }

  get status(): VendorStatus {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get snapshot(): Readonly<VendorProps> {
    return { ...this.props };
  }

  /** FR-VND-002 approval branch. Conceptually emits EV-VND-002
   * `vendor.verified` — the caller (use case) is responsible for recording
   * that, since domain entities stay side-effect free. */
  approve(now: Date): void {
    this.props.status = 'verified';
    this.props.verifiedAt = now;
    this.props.rejectedReason = null;
    this.props.updatedAt = now;
  }

  /** FR-VND-002 rejection branch. Conceptually emits EV-VND-003
   * `vendor.rejected`. AC: rejection with reason allows resubmission — this
   * slice does not build a resubmission flow, but does not block one either
   * (status can be re-approved later by another verify call). */
  reject(reason: string, now: Date): void {
    this.props.status = 'rejected';
    this.props.rejectedReason = reason;
    this.props.verifiedAt = null;
    this.props.updatedAt = now;
  }

  /** FR-VND-003 — store profile fields only (business_name, description,
   * logo_url, banner_url). Policies/documents/staff are out of scope. */
  updateStoreProfile(params: {
    businessName?: string;
    description?: string | null;
    logoUrl?: string | null;
    bannerUrl?: string | null;
    now: Date;
  }): void {
    if (params.businessName !== undefined) {
      this.props.businessName = params.businessName;
    }
    if (params.description !== undefined) {
      this.props.description = params.description;
    }
    if (params.logoUrl !== undefined) {
      this.props.logoUrl = params.logoUrl;
    }
    if (params.bannerUrl !== undefined) {
      this.props.bannerUrl = params.bannerUrl;
    }
    this.props.updatedAt = params.now;
  }
}
