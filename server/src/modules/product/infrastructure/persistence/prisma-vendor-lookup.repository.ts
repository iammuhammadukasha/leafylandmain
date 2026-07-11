import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  VendorLookupRepository,
  VendorSummary,
} from '../../domain/repositories/vendor-lookup.repository';

/**
 * Read-only lookup over the Vendor-context `vendors` table (Volume 04 §4),
 * scoped to the two queries Product's use cases need. See the port's doc
 * comment (domain/repositories/vendor-lookup.repository.ts) for why this
 * lives in Product's own infrastructure layer rather than importing
 * Vendor's PrismaVendorRepository/domain entity directly.
 */
@Injectable()
export class PrismaVendorLookupRepository implements VendorLookupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOwnerUserId(ownerUserId: string): Promise<VendorSummary | null> {
    const row = await this.prisma.vendor.findFirst({
      where: { ownerUserId, deletedAt: null },
    });
    return row
      ? { id: row.id, ownerUserId: row.ownerUserId, status: row.status }
      : null;
  }

  async findById(id: string): Promise<VendorSummary | null> {
    const row = await this.prisma.vendor.findUnique({ where: { id } });
    return row
      ? { id: row.id, ownerUserId: row.ownerUserId, status: row.status }
      : null;
  }
}
