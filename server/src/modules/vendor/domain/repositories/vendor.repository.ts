import type { Vendor } from '../entities/vendor.entity';

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here.
 */
export interface VendorRepository {
  findById(id: string): Promise<Vendor | null>;
  findByOwnerUserId(ownerUserId: string): Promise<Vendor | null>;
  save(vendor: Vendor): Promise<void>;
}

export const VENDOR_REPOSITORY = Symbol('VENDOR_REPOSITORY');
