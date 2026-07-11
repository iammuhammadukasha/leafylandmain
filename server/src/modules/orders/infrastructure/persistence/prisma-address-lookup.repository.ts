import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type {
  AddressLookupRepository,
  AddressSummary,
} from '../../domain/repositories/address-lookup.repository';

/**
 * Read-only lookup over the User-context `addresses` table (Volume 04
 * §3). See the port's doc comment
 * (domain/repositories/address-lookup.repository.ts) for the gap note on
 * why Orders owns this instead of importing a User-module address
 * repository (none exists yet).
 */
@Injectable()
export class PrismaAddressLookupRepository implements AddressLookupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AddressSummary | null> {
    const row = await this.prisma.address.findUnique({ where: { id } });
    if (!row || row.deletedAt) {
      return null;
    }
    return { id: row.id, userId: row.userId };
  }
}
