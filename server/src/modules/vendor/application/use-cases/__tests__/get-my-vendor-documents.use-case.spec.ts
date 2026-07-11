import { randomUUID } from 'node:crypto';
import { GetMyVendorDocumentsUseCase } from '../get-my-vendor-documents.use-case';
import { Vendor } from '../../../domain/entities/vendor.entity';
import { VendorDocument } from '../../../domain/entities/vendor-document.entity';
import { InMemoryVendorRepository } from '../../__tests__/fakes/in-memory-vendor.repository';
import { InMemoryVendorDocumentRepository } from '../../__tests__/fakes/in-memory-vendor-document.repository';
import { VendorNotFoundError } from '../../../domain/errors/vendor.errors';

async function seedVendor(
  vendors: InMemoryVendorRepository,
  ownerUserId = 'owner-1',
): Promise<Vendor> {
  const vendor = Vendor.register({
    id: randomUUID(),
    ownerUserId,
    businessName: 'Green Leaf Organics',
    description: null,
    now: new Date(),
  });
  await vendors.save(vendor);
  return vendor;
}

function buildUseCase() {
  const vendors = new InMemoryVendorRepository();
  const documents = new InMemoryVendorDocumentRepository();
  const useCase = new GetMyVendorDocumentsUseCase(vendors, documents);
  return { useCase, vendors, documents };
}

describe('GetMyVendorDocumentsUseCase', () => {
  it('lists only the caller vendor documents', async () => {
    const { useCase, vendors, documents } = buildUseCase();
    const vendor = await seedVendor(vendors);
    const otherVendor = await seedVendor(vendors, 'owner-2');

    await documents.save(
      VendorDocument.submit({
        id: randomUUID(),
        vendorId: vendor.id,
        type: 'organic_certificate',
        fileUrl: 'https://example.com/a.pdf',
        expiresAt: null,
        now: new Date(),
      }),
    );
    await documents.save(
      VendorDocument.submit({
        id: randomUUID(),
        vendorId: otherVendor.id,
        type: 'business_registration',
        fileUrl: 'https://example.com/b.pdf',
        expiresAt: null,
        now: new Date(),
      }),
    );

    const result = await useCase.execute({ userId: 'owner-1' });

    expect(result).toHaveLength(1);
    expect(result[0].vendorId).toBe(vendor.id);
  });

  it('throws VendorNotFoundError when the caller has no vendor', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({ userId: 'no-vendor-user' }),
    ).rejects.toBeInstanceOf(VendorNotFoundError);
  });
});
