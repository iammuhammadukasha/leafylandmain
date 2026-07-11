import type { Review } from '../../../domain/entities/review.entity';
import type {
  ReviewListPage,
  ReviewRepository,
} from '../../../domain/repositories/review.repository';

export class InMemoryReviewRepository implements ReviewRepository {
  private readonly reviewsById = new Map<string, Review>();

  findById(id: string): Promise<Review | null> {
    return Promise.resolve(this.reviewsById.get(id) ?? null);
  }

  findByOrderLineId(orderLineId: string): Promise<Review | null> {
    for (const review of this.reviewsById.values()) {
      if (review.orderLineId === orderLineId) return Promise.resolve(review);
    }
    return Promise.resolve(null);
  }

  findByProductIdPaginated(params: {
    productId: string;
    cursor: string | null;
    limit: number;
  }): Promise<ReviewListPage> {
    const matching = [...this.reviewsById.values()]
      .filter((r) => r.productId === params.productId)
      .sort(
        (a, b) =>
          b.snapshot.createdAt.getTime() - a.snapshot.createdAt.getTime(),
      );

    const startIndex = params.cursor
      ? matching.findIndex((r) => r.id === params.cursor) + 1
      : 0;
    const page = matching.slice(startIndex, startIndex + params.limit);
    const hasMore = startIndex + params.limit < matching.length;

    return Promise.resolve({
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  }

  save(review: Review): Promise<void> {
    this.reviewsById.set(review.id, review);
    return Promise.resolve();
  }

  get all(): Review[] {
    return [...this.reviewsById.values()];
  }
}
