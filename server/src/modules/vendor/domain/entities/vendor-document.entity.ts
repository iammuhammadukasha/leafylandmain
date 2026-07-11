// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `vendor_documents` (Volume 04 §4) in
// terms the domain cares about, not the DB's terms.
//
// Minimal FR-VND-008 slice: create/list/admin-approve only. No file
// upload/S3 integration (fileUrl is just a string URL), no reject variant,
// no expiring-certificate reminder notifications (EV-VND-006 not emitted).

export type VendorDocumentType =
  'business_registration' | 'organic_certificate' | 'other';

export type VendorDocumentReviewStatus = 'pending' | 'approved' | 'rejected';

export interface VendorDocumentProps {
  id: string;
  vendorId: string;
  type: VendorDocumentType;
  fileUrl: string;
  reviewStatus: VendorDocumentReviewStatus;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class VendorDocument {
  private constructor(private props: VendorDocumentProps) {}

  static reconstitute(props: VendorDocumentProps): VendorDocument {
    return new VendorDocument(props);
  }

  /** Factory for a newly-submitted document (FR-VND-008). Always starts in
   * `pending` review status — approval is a separate admin-reviewed
   * transition (mirrors Vendor.register/approve). */
  static submit(params: {
    id: string;
    vendorId: string;
    type: VendorDocumentType;
    fileUrl: string;
    expiresAt: Date | null;
    now: Date;
  }): VendorDocument {
    return new VendorDocument({
      id: params.id,
      vendorId: params.vendorId,
      type: params.type,
      fileUrl: params.fileUrl,
      reviewStatus: 'pending',
      expiresAt: params.expiresAt,
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get vendorId(): string {
    return this.props.vendorId;
  }

  get type(): VendorDocumentType {
    return this.props.type;
  }

  get reviewStatus(): VendorDocumentReviewStatus {
    return this.props.reviewStatus;
  }

  get snapshot(): Readonly<VendorDocumentProps> {
    return { ...this.props };
  }

  /** Admin approval (this slice's minimal FR-VND-008 write path). */
  approve(now: Date): void {
    this.props.reviewStatus = 'approved';
    this.props.updatedAt = now;
  }

  /** Kept for symmetry / cheap to add per the task's "add reject only if
   * cheap" guidance — not wired to a controller endpoint in this slice. */
  reject(now: Date): void {
    this.props.reviewStatus = 'rejected';
    this.props.updatedAt = now;
  }
}
