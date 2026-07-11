// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `product_variants` (Volume 04 §5) in
// terms the domain cares about, not the DB's terms.

export interface ProductVariantProps {
  id: string;
  productId: string;
  sku: string;
  attributes: Record<string, unknown>;
  priceMinor: bigint;
  stockQuantity: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class ProductVariant {
  private constructor(private props: ProductVariantProps) {}

  static reconstitute(props: ProductVariantProps): ProductVariant {
    return new ProductVariant(props);
  }

  /** FR-VND-005/FR-PRD-002 — a variant's SKU uniqueness (VR-PRD, "every SKU
   * is unique platform-wide") is enforced by the calling use case via a
   * repository lookup BEFORE this factory runs — not something a domain
   * entity can check by itself without a DB round trip. */
  static create(params: {
    id: string;
    productId: string;
    sku: string;
    attributes: Record<string, unknown>;
    priceMinor: bigint;
    stockQuantity: number;
    lowStockThreshold: number;
    now: Date;
  }): ProductVariant {
    return new ProductVariant({
      id: params.id,
      productId: params.productId,
      sku: params.sku,
      attributes: params.attributes,
      priceMinor: params.priceMinor,
      stockQuantity: params.stockQuantity,
      lowStockThreshold: params.lowStockThreshold,
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

  get sku(): string {
    return this.props.sku;
  }

  get snapshot(): Readonly<ProductVariantProps> {
    return { ...this.props };
  }

  /** Basic field updates (task scope: "basic field updates"). SKU is not
   * editable here — changing a platform-wide-unique SKU post-creation
   * would need its own uniqueness re-check flow, out of scope for this
   * slice's PATCH endpoint. */
  update(params: {
    attributes?: Record<string, unknown>;
    priceMinor?: bigint;
    stockQuantity?: number;
    lowStockThreshold?: number;
    now: Date;
  }): void {
    if (params.attributes !== undefined) {
      this.props.attributes = params.attributes;
    }
    if (params.priceMinor !== undefined) {
      this.props.priceMinor = params.priceMinor;
    }
    if (params.stockQuantity !== undefined) {
      this.props.stockQuantity = params.stockQuantity;
    }
    if (params.lowStockThreshold !== undefined) {
      this.props.lowStockThreshold = params.lowStockThreshold;
    }
    this.props.updatedAt = params.now;
  }
}
