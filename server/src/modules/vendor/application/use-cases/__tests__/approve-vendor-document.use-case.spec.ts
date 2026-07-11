import { randomUUID } from 'node:crypto';
import { ApproveVendorDocumentUseCase } from '../approve-vendor-document.use-case';
import { VendorDocument } from '../../../domain/entities/vendor-document.entity';
import { InMemoryVendorDocumentRepository } from '../../__tests__/fakes/in-memory-vendor-document.repository';
import {
  FakeAuditLogger,
  FakeUserRolesRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  VendorDocumentNotFoundError,
  VendorForbiddenError,
} from '../../../domain/errors/vendor.errors';

async function seedDocument(
  documents: InMemoryVendorDocumentRepository,
  vendorId = 'vendor-1',
): Promise<VendorDocument> {
  const document = VendorDocument.submit({
    id: randomUUID(),
    vendorId,
    type: 'organic_certificate',
    fileUrl: 'https://example.com/cert.pdf',
    expiresAt: null,
    now: new Date(),
  });
  await documents.save(document);
  return document;
}

function buildUseCase() {
  const documents = new InMemoryVendorDocumentRepository();
  const userRoles = new FakeUserRolesRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new ApproveVendorDocumentUseCase(
    documents,
    userRoles,
    auditLogger,
  );

  return { useCase, documents, userRoles, auditLogger };
}

describe('ApproveVendorDocumentUseCase', () => {
  it('approves a pending document when the actor is an admin', async () => {
    const { useCase, documents, userRoles } = buildUseCase();
    const document = await seedDocument(documents);
    userRoles.grant('admin-1', 'admin');

    const result = await useCase.execute({
      actorUserId: 'admin-1',
      documentId: document.id,
      ipAddress: '127.0.0.1',
    });

    expect(result.reviewStatus).toBe('approved');
  });

  it('records a vendor.document_approved audit event', async () => {
    const { useCase, documents, userRoles, auditLogger } = buildUseCase();
    const document = await seedDocument(documents);
    userRoles.grant('admin-1', 'admin');

    await useCase.execute({
      actorUserId: 'admin-1',
      documentId: document.id,
      ipAddress: null,
    });

    expect(auditLogger.events.map((e) => e.action)).toContain(
      'vendor.document_approved',
    );
  });

  it('throws VendorForbiddenError when the actor is not an admin', async () => {
    const { useCase, documents, userRoles } = buildUseCase();
    const document = await seedDocument(documents);
    userRoles.grant('user-2', 'vendor_owner', document.vendorId);

    await expect(
      useCase.execute({
        actorUserId: 'user-2',
        documentId: document.id,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(VendorForbiddenError);
  });

  it('throws VendorDocumentNotFoundError for a nonexistent document id', async () => {
    const { useCase, userRoles } = buildUseCase();
    userRoles.grant('admin-1', 'admin');

    await expect(
      useCase.execute({
        actorUserId: 'admin-1',
        documentId: randomUUID(),
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(VendorDocumentNotFoundError);
  });
});
