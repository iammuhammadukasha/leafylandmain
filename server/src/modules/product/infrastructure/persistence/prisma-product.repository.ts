import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  ProductListPage,
  ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  Product,
  type ProductProps,
} from '../../domain/entities/product.entity';
import type { Product as PrismaProduct } from '@prisma/client';

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({ where: { id } });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async findByVendorId(vendorId: string): Promise<Product[]> {
    const rows = await this.prisma.product.findMany({
      where: { vendorId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findActivePaginated(params: {
    cursor: string | null;
    limit: number;
  }): Promise<ProductListPage> {
    // Cursor = opaque product id (API Spec §1.5). We fetch limit+1 rows
    // ordered by (createdAt desc, id desc) — a stable composite order so
    // pagination doesn't skip/repeat rows with identical createdAt values
    // — to know whether a next page exists.
    const rows = await this.prisma.product.findMany({
      where: { status: 'active', deletedAt: null },
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

  async save(product: Product): Promise<void> {
    const props = product.snapshot;
    await this.prisma.product.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        vendorId: props.vendorId,
        categoryId: props.categoryId,
        brandId: props.brandId,
        title: props.title,
        description: props.description,
        isOrganicClaim: props.isOrganicClaim,
        organicCertDocumentId: props.organicCertDocumentId,
        status: props.status,
        version: props.version,
      },
      update: {
        categoryId: props.categoryId,
        brandId: props.brandId,
        title: props.title,
        description: props.description,
        isOrganicClaim: props.isOrganicClaim,
        organicCertDocumentId: props.organicCertDocumentId,
        status: props.status,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaProduct): Product {
    const props: ProductProps = {
      id: row.id,
      vendorId: row.vendorId,
      categoryId: row.categoryId,
      brandId: row.brandId,
      title: row.title,
      description: row.description,
      isOrganicClaim: row.isOrganicClaim,
      organicCertDocumentId: row.organicCertDocumentId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Product.reconstitute(props);
  }
}
