import { Inject, Injectable } from '@nestjs/common';
import type { VendorDocumentProps } from '../../domain/entities/vendor-document.entity';
import {
  VENDOR_DOCUMENT_REPOSITORY,
  type VendorDocumentRepository,
} from '../../domain/repositories/vendor-document.repository';
import {
  USER_ROLES_REPOSITORY,
  type UserRolesRepository,
} from '../../domain/repositories/user-roles.repository';
import {
  VendorDocumentNotFoundError,
  VendorForbiddenError,
} from '../../domain/errors/vendor.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface ApproveVendorDocumentInput {
  actorUserId: string;
  documentId: string;
  ipAddress: string | null;
}

export type ApproveVendorDocumentResult = VendorDocumentProps;

/**
 * POST /api/v1/vendors/documents/:documentId/approve — admin-only, the
 * minimal FR-VND-008 write path this slice needs to unblock BR-PRD-01 /
 * BR-VND-02 (organic claim requires an approved certification document).
 * Same admin-authorization pattern as VerifyVendorUseCase: a DB-backed role
 * lookup via UserRolesRepository (application-layer check, not a route
 * guard) rather than a new authorization mechanism, per the task's "reuse
 * the DB-backed role/ownership-check pattern" constraint. A reject variant
 * is not built — the task scoped it to "only if cheap given the approve
 * implementation," and the organic-claim flow this slice proves only
 * exercises the approve path.
 */
@Injectable()
export class ApproveVendorDocumentUseCase {
  constructor(
    @Inject(VENDOR_DOCUMENT_REPOSITORY)
    private readonly documents: VendorDocumentRepository,
    @Inject(USER_ROLES_REPOSITORY)
    private readonly userRoles: UserRolesRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(
    input: ApproveVendorDocumentInput,
  ): Promise<ApproveVendorDocumentResult> {
    const isAdmin = await this.userRoles.hasRole(input.actorUserId, 'admin');
    if (!isAdmin) {
      throw new VendorForbiddenError(
        'Only admins can approve vendor documents.',
      );
    }

    const document = await this.documents.findById(input.documentId);
    if (!document) {
      throw new VendorDocumentNotFoundError();
    }

    const now = new Date();
    document.approve(now);
    await this.documents.save(document);

    await this.auditLogger.record({
      actorUserId: input.actorUserId,
      action: 'vendor.document_approved',
      targetType: 'vendor_document',
      targetId: document.id,
      ipAddress: input.ipAddress,
    });

    return document.snapshot;
  }
}
