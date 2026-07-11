import { Inject, Injectable } from '@nestjs/common';
import type { VendorDocumentProps } from '../../domain/entities/vendor-document.entity';
import {
  VENDOR_DOCUMENT_REPOSITORY,
  type VendorDocumentRepository,
} from '../../domain/repositories/vendor-document.repository';
import {
  VENDOR_REPOSITORY,
  type VendorRepository,
} from '../../domain/repositories/vendor.repository';
import { VendorNotFoundError } from '../../domain/errors/vendor.errors';

export interface GetMyVendorDocumentsInput {
  userId: string;
}

export type GetMyVendorDocumentsResult = VendorDocumentProps[];

/**
 * GET /api/v1/vendors/me/documents — FR-VND-008. vendor_owner/vendor_staff
 * per the API spec, but (as with GetMyVendorUseCase) only vendor_owner is
 * wired in this slice since staff invitations aren't built — scoping is
 * structural via ownerUserId lookup, same precedent as the rest of this
 * module.
 */
@Injectable()
export class GetMyVendorDocumentsUseCase {
  constructor(
    @Inject(VENDOR_REPOSITORY) private readonly vendors: VendorRepository,
    @Inject(VENDOR_DOCUMENT_REPOSITORY)
    private readonly documents: VendorDocumentRepository,
  ) {}

  async execute(
    input: GetMyVendorDocumentsInput,
  ): Promise<GetMyVendorDocumentsResult> {
    const vendor = await this.vendors.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new VendorNotFoundError();
    }

    const documents = await this.documents.findByVendorId(vendor.id);
    return documents.map((document) => document.snapshot);
  }
}
