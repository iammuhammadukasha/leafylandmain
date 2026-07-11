import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { VendorDocumentRepository } from '../../domain/repositories/vendor-document.repository';
import {
  VendorDocument,
  type VendorDocumentProps,
} from '../../domain/entities/vendor-document.entity';
import type { VendorDocument as PrismaVendorDocument } from '@prisma/client';

@Injectable()
export class PrismaVendorDocumentRepository implements VendorDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<VendorDocument | null> {
    const row = await this.prisma.vendorDocument.findUnique({
      where: { id },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByVendorId(vendorId: string): Promise<VendorDocument[]> {
    const rows = await this.prisma.vendorDocument.findMany({
      where: { vendorId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async save(document: VendorDocument): Promise<void> {
    const props = document.snapshot;
    await this.prisma.vendorDocument.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        vendorId: props.vendorId,
        type: props.type,
        fileUrl: props.fileUrl,
        reviewStatus: props.reviewStatus,
        expiresAt: props.expiresAt,
        version: props.version,
      },
      update: {
        type: props.type,
        fileUrl: props.fileUrl,
        reviewStatus: props.reviewStatus,
        expiresAt: props.expiresAt,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaVendorDocument): VendorDocument {
    const props: VendorDocumentProps = {
      id: row.id,
      vendorId: row.vendorId,
      type: row.type,
      fileUrl: row.fileUrl,
      reviewStatus: row.reviewStatus,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return VendorDocument.reconstitute(props);
  }
}
