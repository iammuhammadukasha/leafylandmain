import type { Category } from '../../../domain/entities/category.entity';
import type { CategoryRepository } from '../../../domain/repositories/category.repository';

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly categoriesById = new Map<string, Category>();

  findById(id: string): Promise<Category | null> {
    return Promise.resolve(this.categoriesById.get(id) ?? null);
  }

  findBySlug(slug: string): Promise<Category | null> {
    for (const category of this.categoriesById.values()) {
      if (category.slug === slug) return Promise.resolve(category);
    }
    return Promise.resolve(null);
  }

  findAll(): Promise<Category[]> {
    return Promise.resolve([...this.categoriesById.values()]);
  }

  save(category: Category): Promise<void> {
    this.categoriesById.set(category.id, category);
    return Promise.resolve();
  }

  get all(): Category[] {
    return [...this.categoriesById.values()];
  }
}
