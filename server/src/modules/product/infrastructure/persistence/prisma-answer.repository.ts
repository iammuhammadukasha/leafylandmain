import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AnswerRepository } from '../../domain/repositories/answer.repository';
import { Answer, type AnswerProps } from '../../domain/entities/answer.entity';
import type { Answer as PrismaAnswer } from '@prisma/client';

@Injectable()
export class PrismaAnswerRepository implements AnswerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByQuestionId(questionId: string): Promise<Answer[]> {
    const rows = await this.prisma.answer.findMany({
      where: { questionId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(answer: Answer): Promise<void> {
    const props = answer.snapshot;
    await this.prisma.answer.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        questionId: props.questionId,
        answeredBy: props.answeredBy,
        body: props.body,
        version: props.version,
      },
      update: {
        body: props.body,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaAnswer): Answer {
    const props: AnswerProps = {
      id: row.id,
      questionId: row.questionId,
      answeredBy: row.answeredBy,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Answer.reconstitute(props);
  }
}
