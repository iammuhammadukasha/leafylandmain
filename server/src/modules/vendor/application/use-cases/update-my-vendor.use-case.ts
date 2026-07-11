import { Inject, Injectable } from '@nestjs/common';
import type { VendorProps } from '../../domain/entities/vendor.entity';
import {
  VENDOR_REPOSITORY,
  type VendorRepository,
} from '../../domain/repositories/vendor.repository';
import { VendorNotFoundError } from '../../domain/errors/vendor.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface UpdateMyVendorInput {
  userId: string;
  businessName?: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  ipAddress: string | null;
}

export type UpdateMyVendorResult = VendorProps;

/**
 * PATCH /api/v1/vendors/me — FR-VND-003 store management. Updates only the
 * store-profile fields modeled in this slice (business_name, description,
 * logo_url, banner_url); policies/business-hours are out of scope (not in
 * the Volume 04 §4 `vendors` table columns list this slice builds).
 * Scoped to the caller's own vendor the same way GetMyVendorUseCase is
 * (looked up by ownerUserId, not by an attacker-suppliable vendorId).
 */
@Injectable()
export class UpdateMyVendorUseCase {
  constructor(
    @Inject(VENDOR_REPOSITORY) private readonly vendors: VendorRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: UpdateMyVendorInput): Promise<UpdateMyVendorResult> {
    const vendor = await this.vendors.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new VendorNotFoundError();
    }

    const now = new Date();
    vendor.updateStoreProfile({
      businessName: input.businessName,
      description: input.description,
      logoUrl: input.logoUrl,
      bannerUrl: input.bannerUrl,
      now,
    });

    await this.vendors.save(vendor);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'vendor.store_profile_updated',
      targetType: 'vendor',
      targetId: vendor.id,
      ipAddress: input.ipAddress,
    });

    return vendor.snapshot;
  }
}
