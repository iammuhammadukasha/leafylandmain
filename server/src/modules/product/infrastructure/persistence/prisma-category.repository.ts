import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { CategoryRepository } from '../../domain/repositories/category.repository';
import {
  Category,
  type CategoryProps,
} from '../../domain/entities/category.entity';
import type { Category as PrismaCategory } from '@prisma/client';

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const row = await this.prisma.category.findFirst({
      where: { slug, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(category: Category): Promise<void> {
    const props = category.snapshot;
    await this.prisma.category.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        parentId: props.parentId,
        name: props.name,
        slug: props.slug,
        taxRateBps: props.taxRateBps,
        version: props.version,
      },
      update: {
        parentId: props.parentId,
        name: props.name,
        slug: props.slug,
        taxRateBps: props.taxRateBps,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaCategory): Category {
    const props: CategoryProps = {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      taxRateBps: row.taxRateBps,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Category.reconstitute(props);
  }
}
