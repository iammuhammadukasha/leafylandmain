import { Inject, Injectable } from '@nestjs/common';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  QUESTION_REPOSITORY,
  type QuestionRepository,
} from '../../domain/repositories/question.repository';
import {
  ANSWER_REPOSITORY,
  type AnswerRepository,
} from '../../domain/repositories/answer.repository';
import type { QuestionProps } from '../../domain/entities/question.entity';
import type { AnswerProps } from '../../domain/entities/answer.entity';
import { ProductNotFoundError } from '../../domain/errors/product.errors';

export interface GetProductQuestionsInput {
  productId: string;
  cursor: string | null;
  limit: number;
}

export interface QuestionWithAnswers {
  question: QuestionProps;
  answers: AnswerProps[];
}

export interface GetProductQuestionsResult {
  items: QuestionWithAnswers[];
  nextCursor: string | null;
}

/**
 * GET /api/v1/catalog/products/:id/questions — FR-PRD-004, public,
 * cursor-paginated. Returns each question with its answers inline (a
 * question thread), since the API spec doesn't define a separate "list
 * answers" endpoint — answers are only ever created via
 * POST /questions/:id/answers and read as part of this listing.
 */
@Injectable()
export class GetProductQuestionsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(QUESTION_REPOSITORY)
    private readonly questions: QuestionRepository,
    @Inject(ANSWER_REPOSITORY) private readonly answers: AnswerRepository,
  ) {}

  async execute(
    input: GetProductQuestionsInput,
  ): Promise<GetProductQuestionsResult> {
    const product = await this.products.findById(input.productId);
    if (!product) {
      throw new ProductNotFoundError();
    }

    const page = await this.questions.findByProductIdPaginated({
      productId: input.productId,
      cursor: input.cursor,
      limit: input.limit,
    });

    const items = await Promise.all(
      page.items.map(async (question) => {
        const answers = await this.answers.findByQuestionId(question.id);
        return {
          question: question.snapshot,
          answers: answers.map((answer) => answer.snapshot),
        };
      }),
    );

    return { items, nextCursor: page.nextCursor };
  }
}
