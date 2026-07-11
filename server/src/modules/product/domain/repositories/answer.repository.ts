import type { Answer } from '../entities/answer.entity';

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface AnswerRepository {
  /** All answers for a question, oldest first — used both by
   * AnswerQuestionUseCase's public listing join and could back a future
   * "one question, many answers" thread view. This slice's public Q&A read
   * (GetProductQuestionsUseCase) fetches per-question via this method. */
  findByQuestionId(questionId: string): Promise<Answer[]>;
  save(answer: Answer): Promise<void>;
}

export const ANSWER_REPOSITORY = Symbol('ANSWER_REPOSITORY');
