// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `products` (Volume 04 §5) in terms
// the domain cares about, not the DB's terms.

export type ProductStatus = 'draft' | 'active' | 'delisted';

export interface ProductProps {
  id: string;
  vendorId: string;
  categoryId: string;
  brandId: string | null;
  title: string;
  description: string | null;
  isOrganicClaim: boolean;
  organicCertDocumentId: string | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class Product {
  private constructor(private props: ProductProps) {}

  static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  /** Factory for a new vendor product listing (FR-VND-005, FR-PRD-002).
   * Always starts in `draft` status — publishing (draft -> active) is a
   * separate use case gated on vendor verification. The organic-claim rule
   * (BR-PRD-01/BR-VND-02) is validated by the calling use case BEFORE this
   * factory is invoked (it needs to check the referenced document's
   * approval status via a repository, which is an application-layer
   * concern, not something a domain entity can reach for itself). */
  static create(params: {
    id: string;
    vendorId: string;
    categoryId: string;
    brandId: string | null;
    title: string;
    description: string | null;
    isOrganicClaim: boolean;
    organicCertDocumentId: string | null;
    now: Date;
  }): Product {
    return new Product({
      id: params.id,
      vendorId: params.vendorId,
      categoryId: params.categoryId,
      brandId: params.brandId,
      title: params.title,
      description: params.description,
      isOrganicClaim: params.isOrganicClaim,
      organicCertDocumentId: params.organicCertDocumentId,
      status: 'draft',
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

  get status(): ProductStatus {
    return this.props.status;
  }

  get snapshot(): Readonly<ProductProps> {
    return { ...this.props };
  }

  /** FR-VND-005 — PATCH-style partial update of editable fields. Status,
   * vendorId, and organic-claim/cert fields are not editable through this
   * method — organic-claim changes would need to re-run the BR-PRD-01
   * check (out of scope for this slice's PATCH endpoint, which only
   * covers title/description/category/brand per the task's field list). */
  update(params: {
    title?: string;
    description?: string | null;
    categoryId?: string;
    brandId?: string | null;
    now: Date;
  }): void {
    if (params.title !== undefined) {
      this.props.title = params.title;
    }
    if (params.description !== undefined) {
      this.props.description = params.description;
    }
    if (params.categoryId !== undefined) {
      this.props.categoryId = params.categoryId;
    }
    if (params.brandId !== undefined) {
      this.props.brandId = params.brandId;
    }
    this.props.updatedAt = params.now;
  }

  /** draft -> active (FR-VND-005). Caller (use case) is responsible for
   * checking vendor verification status first (VENDOR_NOT_VERIFIED) —
   * that's a cross-context check this entity cannot make itself. */
  publish(now: Date): void {
    this.props.status = 'active';
    this.props.updatedAt = now;
  }

  /** active/draft -> delisted (FR-VND-005). */
  delist(now: Date): void {
    this.props.status = 'delisted';
    this.props.updatedAt = now;
  }
}
