import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { ProductVariantRepository } from '../../domain/repositories/product-variant.repository';
import {
  ProductVariant,
  type ProductVariantProps,
} from '../../domain/entities/product-variant.entity';
import type {
  ProductVariant as PrismaProductVariant,
  Prisma,
} from '@prisma/client';

@Injectable()
export class PrismaProductVariantRepository implements ProductVariantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProductVariant | null> {
    const row = await this.prisma.productVariant.findUnique({
      where: { id },
    });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async findByProductId(productId: string): Promise<ProductVariant[]> {
    const rows = await this.prisma.productVariant.findMany({
      where: { productId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findBySku(sku: string): Promise<ProductVariant | null> {
    const row = await this.prisma.productVariant.findFirst({
      where: { sku, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(variant: ProductVariant): Promise<void> {
    const props = variant.snapshot;
    await this.prisma.productVariant.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        productId: props.productId,
        sku: props.sku,
        attributes: props.attributes as Prisma.InputJsonValue,
        priceMinor: props.priceMinor,
        stockQuantity: props.stockQuantity,
        lowStockThreshold: props.lowStockThreshold,
        version: props.version,
      },
      update: {
        attributes: props.attributes as Prisma.InputJsonValue,
        priceMinor: props.priceMinor,
        stockQuantity: props.stockQuantity,
        lowStockThreshold: props.lowStockThreshold,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaProductVariant): ProductVariant {
    const props: ProductVariantProps = {
      id: row.id,
      productId: row.productId,
      sku: row.sku,
      attributes: row.attributes as Record<string, unknown>,
      priceMinor: row.priceMinor,
      stockQuantity: row.stockQuantity,
      lowStockThreshold: row.lowStockThreshold,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return ProductVariant.reconstitute(props);
  }
}
