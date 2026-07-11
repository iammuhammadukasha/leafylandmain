import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Vendor, type VendorProps } from '../../domain/entities/vendor.entity';
import {
  VENDOR_REPOSITORY,
  type VendorRepository,
} from '../../domain/repositories/vendor.repository';
import {
  VENDOR_ROLE_GRANT_REPOSITORY,
  type VendorRoleGrantRepository,
} from '../../domain/repositories/vendor-role-grant.repository';
import { VendorAlreadyExistsError } from '../../domain/errors/vendor.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface RegisterVendorInput {
  ownerUserId: string;
  businessName: string;
  description: string | null;
  ipAddress: string | null;
}

export type RegisterVendorResult = VendorProps;

/**
 * FR-VND-001 — Vendor registration. A user applies to become a vendor;
 * created in `pending` status (AC: not usable as a storefront until
 * FR-VND-002 verification passes). Also grants the calling user a
 * `vendor_owner` role scoped to the new vendor (a `user_roles` row with
 * `vendor_id` set), via VendorRoleGrantRepository.
 *
 * Conceptually emits `EV-VND-001 vendor.registered`. This codebase has no
 * BullMQ wiring yet for ANY module (Identity emits nothing onto a queue
 * either — it only writes to the audit log and, for email, logs to
 * console/file). Matching that precedent, this slice records the audit
 * event and does not invent new cross-cutting queue infra.
 *
 * One user may own at most one vendor in this slice (VendorAlreadyExistsError
 * otherwise) — the API spec and SRS don't state a multi-vendor-per-owner
 * rule either way; this is the minimal reasonable interpretation consistent
 * with `users 1—1 vendors (owner_user_id)` in Volume 04 §8's ERD summary.
 */
@Injectable()
export class RegisterVendorUseCase {
  constructor(
    @Inject(VENDOR_REPOSITORY) private readonly vendors: VendorRepository,
    @Inject(VENDOR_ROLE_GRANT_REPOSITORY)
    private readonly roleGrants: VendorRoleGrantRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: RegisterVendorInput): Promise<RegisterVendorResult> {
    const existing = await this.vendors.findByOwnerUserId(input.ownerUserId);
    if (existing) {
      throw new VendorAlreadyExistsError();
    }

    const now = new Date();
    const vendor = Vendor.register({
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      businessName: input.businessName,
      description: input.description,
      now,
    });

    await this.vendors.save(vendor);
    await this.roleGrants.grantVendorOwner(input.ownerUserId, vendor.id);

    await this.auditLogger.record({
      actorUserId: input.ownerUserId,
      action: 'vendor.registered',
      targetType: 'vendor',
      targetId: vendor.id,
      ipAddress: input.ipAddress,
    });

    return vendor.snapshot;
  }
}
