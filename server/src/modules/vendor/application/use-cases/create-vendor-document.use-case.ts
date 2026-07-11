import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  VendorDocument,
  type VendorDocumentProps,
  type VendorDocumentType,
} from '../../domain/entities/vendor-document.entity';
import {
  VENDOR_DOCUMENT_REPOSITORY,
  type VendorDocumentRepository,
} from '../../domain/repositories/vendor-document.repository';
import {
  VENDOR_REPOSITORY,
  type VendorRepository,
} from '../../domain/repositories/vendor.repository';
import { VendorNotFoundError } from '../../domain/errors/vendor.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface CreateVendorDocumentInput {
  userId: string;
  type: VendorDocumentType;
  fileUrl: string;
  expiresAt: Date | null;
  ipAddress: string | null;
}

export type CreateVendorDocumentResult = VendorDocumentProps;

/**
 * POST /api/v1/vendors/me/documents — FR-VND-008 (minimal slice). Vendor
 * owner submits a document; always created in `pending` review status
 * (admin approval is a separate use case, mirrors vendor
 * registration/verification). Scoped to the caller's own vendor the same
 * way GetMyVendorUseCase is — looked up by ownerUserId, not an
 * attacker-suppliable vendorId, so vendor_staff support is deferred
 * alongside staff invitations (see GetMyVendorUseCase's doc comment for
 * the same precedent).
 */
@Injectable()
export class CreateVendorDocumentUseCase {
  constructor(
    @Inject(VENDOR_REPOSITORY) private readonly vendors: VendorRepository,
    @Inject(VENDOR_DOCUMENT_REPOSITORY)
    private readonly documents: VendorDocumentRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(
    input: CreateVendorDocumentInput,
  ): Promise<CreateVendorDocumentResult> {
    const vendor = await this.vendors.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new VendorNotFoundError();
    }

    const now = new Date();
    const document = VendorDocument.submit({
      id: randomUUID(),
      vendorId: vendor.id,
      type: input.type,
      fileUrl: input.fileUrl,
      expiresAt: input.expiresAt,
      now,
    });

    await this.documents.save(document);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'vendor.document_submitted',
      targetType: 'vendor_document',
      targetId: document.id,
      diff: { type: input.type },
      ipAddress: input.ipAddress,
    });

    return document.snapshot;
  }
}
