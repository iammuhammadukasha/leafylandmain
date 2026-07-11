import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  VendorDocumentLookupRepository,
  VendorDocumentSummary,
} from '../../domain/repositories/vendor-document-lookup.repository';

/**
 * Read-only lookup over the Vendor-context `vendor_documents` table
 * (Volume 04 §4), scoped to the one query RegisterProductUseCase needs to
 * enforce BR-PRD-01/BR-VND-02. See the port's doc comment for why this
 * lives in Product's own infrastructure layer.
 */
@Injectable()
export class PrismaVendorDocumentLookupRepository implements VendorDocumentLookupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<VendorDocumentSummary | null> {
    const row = await this.prisma.vendorDocument.findUnique({
      where: { id },
    });
    if (!row || row.deletedAt) {
      return null;
    }
    return {
      id: row.id,
      vendorId: row.vendorId,
      type: row.type,
      reviewStatus: row.reviewStatus,
    };
  }
}
