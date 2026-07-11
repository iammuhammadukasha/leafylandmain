import { randomUUID } from 'node:crypto';
import { GetMyVendorUseCase } from '../get-my-vendor.use-case';
import { Vendor } from '../../../domain/entities/vendor.entity';
import { InMemoryVendorRepository } from '../../__tests__/fakes/in-memory-vendor.repository';
import { VendorNotFoundError } from '../../../domain/errors/vendor.errors';

describe('GetMyVendorUseCase', () => {
  it("returns the caller's own vendor", async () => {
    const vendors = new InMemoryVendorRepository();
    const vendor = Vendor.register({
      id: randomUUID(),
      ownerUserId: 'owner-1',
      businessName: 'Green Leaf Organics',
      description: null,
      now: new Date(),
    });
    await vendors.save(vendor);

    const useCase = new GetMyVendorUseCase(vendors);
    const result = await useCase.execute({ userId: 'owner-1' });

    expect(result.id).toBe(vendor.id);
    expect(result.ownerUserId).toBe('owner-1');
  });

  it('throws VendorNotFoundError when the caller owns no vendor', async () => {
    const vendors = new InMemoryVendorRepository();
    const useCase = new GetMyVendorUseCase(vendors);

    await expect(
      useCase.execute({ userId: 'no-vendor-user' }),
    ).rejects.toBeInstanceOf(VendorNotFoundError);
  });

  it("never returns a different user's vendor (FR-ID-006 cross-vendor scoping)", async () => {
    const vendors = new InMemoryVendorRepository();
    const ownerAVendor = Vendor.register({
      id: randomUUID(),
      ownerUserId: 'owner-a',
      businessName: 'Vendor A',
      description: null,
      now: new Date(),
    });
    await vendors.save(ownerAVendor);

    const useCase = new GetMyVendorUseCase(vendors);

    await expect(useCase.execute({ userId: 'owner-b' })).rejects.toBeInstanceOf(
      VendorNotFoundError,
    );
  });
});
