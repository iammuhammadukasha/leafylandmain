import { randomUUID } from 'node:crypto';
import { CreateVendorDocumentUseCase } from '../create-vendor-document.use-case';
import { Vendor } from '../../../domain/entities/vendor.entity';
import { InMemoryVendorRepository } from '../../__tests__/fakes/in-memory-vendor.repository';
import { InMemoryVendorDocumentRepository } from '../../__tests__/fakes/in-memory-vendor-document.repository';
import { FakeAuditLogger } from '../../__tests__/fakes/fake-ports';
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
  const auditLogger = new FakeAuditLogger();

  const useCase = new CreateVendorDocumentUseCase(
    vendors,
    documents,
    auditLogger,
  );

  return { useCase, vendors, documents, auditLogger };
}

describe('CreateVendorDocumentUseCase', () => {
  it('creates a document in pending review status for the caller vendor', async () => {
    const { useCase, vendors, documents } = buildUseCase();
    const vendor = await seedVendor(vendors);

    const result = await useCase.execute({
      userId: 'owner-1',
      type: 'organic_certificate',
      fileUrl: 'https://example.com/cert.pdf',
      expiresAt: null,
      ipAddress: '127.0.0.1',
    });

    expect(result.reviewStatus).toBe('pending');
    expect(result.vendorId).toBe(vendor.id);
    expect(result.type).toBe('organic_certificate');
    expect(documents.all).toHaveLength(1);
  });

  it('records a vendor.document_submitted audit event', async () => {
    const { useCase, vendors, auditLogger } = buildUseCase();
    await seedVendor(vendors);

    await useCase.execute({
      userId: 'owner-1',
      type: 'business_registration',
      fileUrl: 'https://example.com/reg.pdf',
      expiresAt: null,
      ipAddress: null,
    });

    expect(auditLogger.events.map((e) => e.action)).toContain(
      'vendor.document_submitted',
    );
  });

  it('throws VendorNotFoundError when the caller has no vendor', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        userId: 'no-vendor-user',
        type: 'organic_certificate',
        fileUrl: 'https://example.com/cert.pdf',
        expiresAt: null,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(VendorNotFoundError);
  });
});
