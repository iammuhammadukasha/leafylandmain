import type { Vendor } from '../../../domain/entities/vendor.entity';
import type { VendorRepository } from '../../../domain/repositories/vendor.repository';

export class InMemoryVendorRepository implements VendorRepository {
  private readonly vendorsById = new Map<string, Vendor>();

  findById(id: string): Promise<Vendor | null> {
    return Promise.resolve(this.vendorsById.get(id) ?? null);
  }

  findByOwnerUserId(ownerUserId: string): Promise<Vendor | null> {
    for (const vendor of this.vendorsById.values()) {
      if (vendor.ownerUserId === ownerUserId) return Promise.resolve(vendor);
    }
    return Promise.resolve(null);
  }

  save(vendor: Vendor): Promise<void> {
    this.vendorsById.set(vendor.id, vendor);
    return Promise.resolve();
  }

  get all(): Vendor[] {
    return [...this.vendorsById.values()];
  }
}
