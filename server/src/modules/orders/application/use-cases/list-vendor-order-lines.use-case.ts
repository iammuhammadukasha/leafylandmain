import { Inject, Injectable } from '@nestjs/common';
import {
  VENDOR_ORDER_LINE_VIEW_REPOSITORY,
  type VendorOrderLinePage,
  type VendorOrderLineViewRepository,
} from '../../domain/repositories/vendor-order-line-view.repository';
import {
  VENDOR_LOOKUP_REPOSITORY,
  type VendorLookupRepository,
} from '../../domain/repositories/vendor-lookup.repository';
import { OrderForbiddenError } from '../../domain/errors/order.errors';

export interface ListVendorOrderLinesInput {
  userId: string;
  page: number;
  pageSize: number;
}

export type ListVendorOrderLinesResult = VendorOrderLinePage;

/**
 * GET /api/v1/vendors/me/orders — FR-ORD-006. Returns order lines
 * belonging to the caller's vendor only, across every buyer's order,
 * offset-paginated (API Spec §1.5 admin-table pagination shape — this is a
 * vendor-facing operational table, same pagination style as admin list
 * endpoints, not the cursor style used for public catalog feeds).
 *
 * Ownership resolution is structural via VendorLookupRepository.
 * findByOwnerUserId, the exact same "vendor_owner only, vendor_staff
 * deferred" precedent Vendor's own GetMyVendorUseCase /
 * GetMyVendorDocumentsUseCase already establish ("only vendor_owner is
 * wired in this slice since staff invitations aren't built" —
 * vendor_staff_invitations, FR-VND-004, is out of scope, so there is no
 * persisted staff->vendor mapping to resolve a vendorId from a bare
 * userId the way AnswerQuestionUseCase's per-vendor role check can once
 * it already has a vendorId in hand from the product/question chain). A
 * caller with no owned vendor gets OrderForbiddenError (403), never a
 * data leak.
 */
@Injectable()
export class ListVendorOrderLinesUseCase {
  constructor(
    @Inject(VENDOR_ORDER_LINE_VIEW_REPOSITORY)
    private readonly vendorOrderLines: VendorOrderLineViewRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
  ) {}

  async execute(
    input: ListVendorOrderLinesInput,
  ): Promise<ListVendorOrderLinesResult> {
    const vendor = await this.vendorLookup.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new OrderForbiddenError(
        'You must have a vendor account to view vendor orders.',
      );
    }

    return this.vendorOrderLines.findByVendorId(
      vendor.id,
      input.page,
      input.pageSize,
    );
  }
}
