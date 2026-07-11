import { Inject, Injectable } from '@nestjs/common';
import type { VendorProps } from '../../domain/entities/vendor.entity';
import {
  VENDOR_REPOSITORY,
  type VendorRepository,
} from '../../domain/repositories/vendor.repository';
import { VendorNotFoundError } from '../../domain/errors/vendor.errors';

export interface GetMyVendorInput {
  userId: string;
}

export type GetMyVendorResult = VendorProps;

/**
 * GET /api/v1/vendors/me — own vendor detail, scoped to the caller's own
 * vendor (FR-ID-006 AC: cannot leak another vendor's data). Scoping is
 * structural here, not a separate authorization check: the lookup is keyed
 * by `ownerUserId = caller`, so there is no vendorId path param an attacker
 * could substitute — the query itself cannot return another vendor's row.
 * (vendor_staff support for this endpoint is deferred along with staff
 * invitations, FR-VND-004 — only vendor_owner is wired in this slice.)
 */
@Injectable()
export class GetMyVendorUseCase {
  constructor(
    @Inject(VENDOR_REPOSITORY) private readonly vendors: VendorRepository,
  ) {}

  async execute(input: GetMyVendorInput): Promise<GetMyVendorResult> {
    const vendor = await this.vendors.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new VendorNotFoundError();
    }
    return vendor.snapshot;
  }
}
