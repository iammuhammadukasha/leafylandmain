import type { Question } from '../entities/question.entity';

export interface QuestionListPage {
  items: Question[];
  nextCursor: string | null;
}

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface QuestionRepository {
  findById(id: string): Promise<Question | null>;
  /** Cursor-paginated questions for a product (public listing, FR-PRD-004),
   * ordered by createdAt desc, id desc for stable pagination. */
  findByProductIdPaginated(params: {
    productId: string;
    cursor: string | null;
    limit: number;
  }): Promise<QuestionListPage>;
  save(question: Question): Promise<void>;
}

export const QUESTION_REPOSITORY = Symbol('QUESTION_REPOSITORY');
