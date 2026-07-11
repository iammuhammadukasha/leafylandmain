// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `categories` (Volume 04 §5) in terms
// the domain cares about, not the DB's terms.

export interface CategoryProps {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  taxRateBps: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

/** FR-PRD-001 — max depth 3, enforced in the application layer (not the
 * DB), per Volume 04 §5's note on the `categories` table. Depth 1 = a
 * root category (parentId null), depth 3 = the deepest allowed level. */
export const MAX_CATEGORY_DEPTH = 3;

export class Category {
  private constructor(private props: CategoryProps) {}

  static reconstitute(props: CategoryProps): Category {
    return new Category(props);
  }

  static create(params: {
    id: string;
    parentId: string | null;
    name: string;
    slug: string;
    taxRateBps: number;
    now: Date;
  }): Category {
    return new Category({
      id: params.id,
      parentId: params.parentId,
      name: params.name,
      slug: params.slug,
      taxRateBps: params.taxRateBps,
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get parentId(): string | null {
    return this.props.parentId;
  }

  get slug(): string {
    return this.props.slug;
  }

  get snapshot(): Readonly<CategoryProps> {
    return { ...this.props };
  }
}
