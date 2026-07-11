import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Question,
  type QuestionProps,
} from '../../domain/entities/question.entity';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  QUESTION_REPOSITORY,
  type QuestionRepository,
} from '../../domain/repositories/question.repository';
import { ProductNotFoundError } from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface AskQuestionInput {
  userId: string;
  productId: string;
  body: string;
  ipAddress: string | null;
}

export type AskQuestionResult = QuestionProps;

/**
 * POST /api/v1/catalog/products/:id/questions — FR-PRD-004. "Q&A is open
 * to any authenticated user" — no purchase/eligibility gate, unlike
 * SubmitReviewUseCase. Only checks the product exists.
 */
@Injectable()
export class AskQuestionUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(QUESTION_REPOSITORY)
    private readonly questions: QuestionRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: AskQuestionInput): Promise<AskQuestionResult> {
    const product = await this.products.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError();
    }

    const now = new Date();
    const question = Question.create({
      id: randomUUID(),
      productId: input.productId,
      userId: input.userId,
      body: input.body,
      now,
    });

    await this.questions.save(question);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'question.asked',
      targetType: 'question',
      targetId: question.id,
      diff: { productId: input.productId },
      ipAddress: input.ipAddress,
    });

    return question.snapshot;
  }
}
