import { Inject, Injectable } from '@nestjs/common';
import type { CategoryProps } from '../../domain/entities/category.entity';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../domain/repositories/category.repository';

export type GetCategoriesResult = CategoryProps[];

/**
 * GET /api/v1/catalog/categories — Public, FR-PRD-001. Returns the flat
 * list of categories; the tree structure is reconstructable client-side
 * from parentId (small dataset — foundation-phase categories, no
 * pagination needed per the task's "at least one seeded category" scope).
 */
@Injectable()
export class GetCategoriesUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categories: CategoryRepository,
  ) {}

  async execute(): Promise<GetCategoriesResult> {
    const all = await this.categories.findAll();
    return all.map((category) => category.snapshot);
  }
}
