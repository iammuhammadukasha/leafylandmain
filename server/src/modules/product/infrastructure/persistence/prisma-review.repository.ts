import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  ReviewListPage,
  ReviewRepository,
} from '../../domain/repositories/review.repository';
import { Review, type ReviewProps } from '../../domain/entities/review.entity';
import type { Review as PrismaReview } from '@prisma/client';

@Injectable()
export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Review | null> {
    const row = await this.prisma.review.findUnique({ where: { id } });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async findByOrderLineId(orderLineId: string): Promise<Review | null> {
    const row = await this.prisma.review.findUnique({
      where: { orderLineId },
    });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async findByProductIdPaginated(params: {
    productId: string;
    cursor: string | null;
    limit: number;
  }): Promise<ReviewListPage> {
    const rows = await this.prisma.review.findMany({
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

  async save(review: Review): Promise<void> {
    const props = review.snapshot;
    await this.prisma.review.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        productId: props.productId,
        userId: props.userId,
        orderLineId: props.orderLineId,
        rating: props.rating,
        body: props.body,
        version: props.version,
      },
      update: {
        rating: props.rating,
        body: props.body,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaReview): Review {
    const props: ReviewProps = {
      id: row.id,
      productId: row.productId,
      userId: row.userId,
      orderLineId: row.orderLineId,
      rating: row.rating,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Review.reconstitute(props);
  }
}
