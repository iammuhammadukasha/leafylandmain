import type { Category } from '../entities/category.entity';

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface CategoryRepository {
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  /** All non-deleted categories, used to build the FR-PRD-001 tree and to
   * compute a candidate parent's current depth. */
  findAll(): Promise<Category[]>;
  save(category: Category): Promise<void>;
}

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
