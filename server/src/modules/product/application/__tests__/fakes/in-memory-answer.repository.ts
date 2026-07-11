import type { Answer } from '../../../domain/entities/answer.entity';
import type { AnswerRepository } from '../../../domain/repositories/answer.repository';

export class InMemoryAnswerRepository implements AnswerRepository {
  private readonly answersById = new Map<string, Answer>();

  findByQuestionId(questionId: string): Promise<Answer[]> {
    return Promise.resolve(
      [...this.answersById.values()]
        .filter((a) => a.questionId === questionId)
        .sort(
          (a, b) =>
            a.snapshot.createdAt.getTime() - b.snapshot.createdAt.getTime(),
        ),
    );
  }

  save(answer: Answer): Promise<void> {
    this.answersById.set(answer.id, answer);
    return Promise.resolve();
  }

  get all(): Answer[] {
    return [...this.answersById.values()];
  }
}
