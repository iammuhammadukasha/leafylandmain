import { Inject, Injectable } from '@nestjs/common';
import type { VendorProps } from '../../domain/entities/vendor.entity';
import {
  VENDOR_REPOSITORY,
  type VendorRepository,
} from '../../domain/repositories/vendor.repository';
import {
  USER_ROLES_REPOSITORY,
  type UserRolesRepository,
} from '../../domain/repositories/user-roles.repository';
import {
  VendorNotFoundError,
  VendorForbiddenError,
} from '../../domain/errors/vendor.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export type VerifyVendorDecision = 'approved' | 'rejected' | 'more_info';

export interface VerifyVendorInput {
  actorUserId: string;
  vendorId: string;
  decision: VerifyVendorDecision;
  reason?: string;
  ipAddress: string | null;
}

export type VerifyVendorResult = VendorProps;

/**
 * FR-VND-002 — Vendor verification (admin only). Admin reviews and either
 * approves, rejects (with reason), or requests more info.
 *
 * `more_info` is accepted by the API contract (§4.1 decision enum) but this
 * slice has no distinct "more_info" vendor status in Volume 04 §4's status
 * enum (pending/verified/rejected/revoked) — treated as a no-op status
 * transition (vendor stays `pending`) that still records the reason via the
 * audit log, since inventing a 5th DB status not in the ERD would be
 * scope creep beyond what this slice's schema section asks for. Noted as a
 * deviation in the final report.
 *
 * Authorization: caller must hold the `admin` role (checked via
 * UserRolesRepository, a DB lookup — see the port's doc comment for the
 * "JWT vs DB lookup" design decision). This is an application-layer check,
 * not a generic decorator/guard, per Constitution §6 (business logic,
 * including authorization decisions tied to a specific use case, does not
 * belong in the framework-facing HTTP layer beyond the coarse
 * "is this token valid" check JwtAuthGuard already does).
 *
 * Approval emits `EV-VND-002 vendor.verified`; rejection emits
 * `EV-VND-003 vendor.rejected` — conceptually (see RegisterVendorUseCase's
 * note on the lack of BullMQ wiring in this codebase); recorded via the
 * audit log instead, matching Identity's precedent.
 */
@Injectable()
export class VerifyVendorUseCase {
  constructor(
    @Inject(VENDOR_REPOSITORY) private readonly vendors: VendorRepository,
    @Inject(USER_ROLES_REPOSITORY)
    private readonly userRoles: UserRolesRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: VerifyVendorInput): Promise<VerifyVendorResult> {
    const isAdmin = await this.userRoles.hasRole(input.actorUserId, 'admin');
    if (!isAdmin) {
      throw new VendorForbiddenError('Only admins can verify vendors.');
    }

    const vendor = await this.vendors.findById(input.vendorId);
    if (!vendor) {
      throw new VendorNotFoundError();
    }

    const now = new Date();

    if (input.decision === 'approved') {
      vendor.approve(now);
      await this.vendors.save(vendor);
      await this.auditLogger.record({
        actorUserId: input.actorUserId,
        action: 'vendor.verified',
        targetType: 'vendor',
        targetId: vendor.id,
        ipAddress: input.ipAddress,
      });
    } else if (input.decision === 'rejected') {
      vendor.reject(input.reason ?? 'No reason provided.', now);
      await this.vendors.save(vendor);
      await this.auditLogger.record({
        actorUserId: input.actorUserId,
        action: 'vendor.rejected',
        targetType: 'vendor',
        targetId: vendor.id,
        diff: { reason: input.reason ?? null },
        ipAddress: input.ipAddress,
      });
    } else {
      // 'more_info' — no status transition in this slice's schema (see
      // class doc); still audited so the request-for-info is traceable.
      await this.auditLogger.record({
        actorUserId: input.actorUserId,
        action: 'vendor.more_info_requested',
        targetType: 'vendor',
        targetId: vendor.id,
        diff: { reason: input.reason ?? null },
        ipAddress: input.ipAddress,
      });
    }

    return vendor.snapshot;
  }
}
