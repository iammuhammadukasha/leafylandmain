import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  QuestionListPage,
  QuestionRepository,
} from '../../domain/repositories/question.repository';
import {
  Question,
  type QuestionProps,
} from '../../domain/entities/question.entity';
import type { Question as PrismaQuestion } from '@prisma/client';

@Injectable()
export class PrismaQuestionRepository implements QuestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Question | null> {
    const row = await this.prisma.question.findUnique({ where: { id } });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async findByProductIdPaginated(params: {
    productId: string;
    cursor: string | null;
    limit: number;
  }): Promise<QuestionListPage> {
    const rows = await this.prisma.question.findMany({
      where: { productId: params.productId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > params.limit;
    const page = hasMore ? rows.slice(0, params.limit) : rows;

    return {
      items: page.map((row) => this.toDomain(row)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async save(question: Question): Promise<void> {
    const props = question.snapshot;
    await this.prisma.question.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        productId: props.productId,
        userId: props.userId,
        body: props.body,
        version: props.version,
      },
      update: {
        body: props.body,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaQuestion): Question {
    const props: QuestionProps = {
      id: row.id,
      productId: row.productId,
      userId: row.userId,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Question.reconstitute(props);
  }
}
