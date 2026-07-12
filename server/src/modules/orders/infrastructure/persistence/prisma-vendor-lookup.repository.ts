import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  OrdersVendorSummary,
  VendorLookupRepository,
} from '../../domain/repositories/vendor-lookup.repository';

/**
 * Read-only lookup over the Vendor-context `vendors` table (Volume 04 §4),
 * scoped to the one query Orders' vendor-fulfillment use cases need. See
 * the port's doc comment (domain/repositories/vendor-lookup.repository.ts)
 * for why this lives in Orders' own infrastructure layer rather than
 * importing Vendor's PrismaVendorRepository/domain entity directly — exact
 * mirror of Product's PrismaVendorLookupRepository.
 */
@Injectable()
export class PrismaOrdersVendorLookupRepository implements VendorLookupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOwnerUserId(
    ownerUserId: string,
  ): Promise<OrdersVendorSummary | null> {
    const row = await this.prisma.vendor.findFirst({
      where: { ownerUserId, deletedAt: null },
    });
    return row ? { id: row.id, ownerUserId: row.ownerUserId } : null;
  }
}
