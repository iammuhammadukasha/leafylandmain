import type { Product } from '../../../domain/entities/product.entity';
import type {
  ProductListPage,
  ProductRepository,
} from '../../../domain/repositories/product.repository';

export class InMemoryProductRepository implements ProductRepository {
  private readonly productsById = new Map<string, Product>();

  findById(id: string): Promise<Product | null> {
    return Promise.resolve(this.productsById.get(id) ?? null);
  }

  findByVendorId(vendorId: string): Promise<Product[]> {
    return Promise.resolve(
      [...this.productsById.values()].filter((p) => p.vendorId === vendorId),
    );
  }

  findActivePaginated(params: {
    cursor: string | null;
    limit: number;
  }): Promise<ProductListPage> {
    const active = [...this.productsById.values()]
      .filter((p) => p.status === 'active')
      .sort(
        (a, b) =>
          b.snapshot.createdAt.getTime() - a.snapshot.createdAt.getTime(),
      );

    const startIndex = params.cursor
      ? active.findIndex((p) => p.id === params.cursor) + 1
      : 0;
    const page = active.slice(startIndex, startIndex + params.limit);
    const hasMore = startIndex + params.limit < active.length;

    return Promise.resolve({
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  }

  save(product: Product): Promise<void> {
    this.productsById.set(product.id, product);
    return Promise.resolve();
  }

  get all(): Product[] {
    return [...this.productsById.values()];
  }
}
