import { randomUUID } from 'node:crypto';
import { UpdateMyVendorUseCase } from '../update-my-vendor.use-case';
import { Vendor } from '../../../domain/entities/vendor.entity';
import { InMemoryVendorRepository } from '../../__tests__/fakes/in-memory-vendor.repository';
import { FakeAuditLogger } from '../../__tests__/fakes/fake-ports';
import { VendorNotFoundError } from '../../../domain/errors/vendor.errors';

async function seedVendor(vendors: InMemoryVendorRepository): Promise<Vendor> {
  const vendor = Vendor.register({
    id: randomUUID(),
    ownerUserId: 'owner-1',
    businessName: 'Green Leaf Organics',
    description: 'Old description',
    now: new Date(),
  });
  await vendors.save(vendor);
  return vendor;
}

describe('UpdateMyVendorUseCase', () => {
  it("updates store profile fields for the caller's own vendor", async () => {
    const vendors = new InMemoryVendorRepository();
    const auditLogger = new FakeAuditLogger();
    await seedVendor(vendors);

    const useCase = new UpdateMyVendorUseCase(vendors, auditLogger);
    const result = await useCase.execute({
      userId: 'owner-1',
      businessName: 'Green Leaf Organics Co.',
      description: 'New description',
      ipAddress: '127.0.0.1',
    });

    expect(result.businessName).toBe('Green Leaf Organics Co.');
    expect(result.description).toBe('New description');
  });

  it('leaves fields not supplied unchanged (PATCH semantics)', async () => {
    const vendors = new InMemoryVendorRepository();
    const auditLogger = new FakeAuditLogger();
    await seedVendor(vendors);

    const useCase = new UpdateMyVendorUseCase(vendors, auditLogger);
    const result = await useCase.execute({
      userId: 'owner-1',
      logoUrl: 'https://example.com/logo.png',
      ipAddress: null,
    });

    expect(result.businessName).toBe('Green Leaf Organics');
    expect(result.description).toBe('Old description');
    expect(result.logoUrl).toBe('https://example.com/logo.png');
  });

  it('throws VendorNotFoundError when the caller owns no vendor', async () => {
    const vendors = new InMemoryVendorRepository();
    const auditLogger = new FakeAuditLogger();
    const useCase = new UpdateMyVendorUseCase(vendors, auditLogger);

    await expect(
      useCase.execute({
        userId: 'no-vendor-user',
        businessName: 'Whatever',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(VendorNotFoundError);
  });
});
