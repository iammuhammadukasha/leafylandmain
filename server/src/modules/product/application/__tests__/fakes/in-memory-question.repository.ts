import type { Question } from '../../../domain/entities/question.entity';
import type {
  QuestionListPage,
  QuestionRepository,
} from '../../../domain/repositories/question.repository';

export class InMemoryQuestionRepository implements QuestionRepository {
  private readonly questionsById = new Map<string, Question>();

  findById(id: string): Promise<Question | null> {
    return Promise.resolve(this.questionsById.get(id) ?? null);
  }

  findByProductIdPaginated(params: {
    productId: string;
    cursor: string | null;
    limit: number;
  }): Promise<QuestionListPage> {
    const matching = [...this.questionsById.values()]
      .filter((q) => q.productId === params.productId)
      .sort(
        (a, b) =>
          b.snapshot.createdAt.getTime() - a.snapshot.createdAt.getTime(),
      );

    const startIndex = params.cursor
      ? matching.findIndex((q) => q.id === params.cursor) + 1
      : 0;
    const page = matching.slice(startIndex, startIndex + params.limit);
    const hasMore = startIndex + params.limit < matching.length;

    return Promise.resolve({
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  }

  save(question: Question): Promise<void> {
    this.questionsById.set(question.id, question);
    return Promise.resolve();
  }

  get all(): Question[] {
    return [...this.questionsById.values()];
  }
}
