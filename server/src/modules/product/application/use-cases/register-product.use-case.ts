import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Product,
  type ProductProps,
} from '../../domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../domain/repositories/category.repository';
import {
  VENDOR_LOOKUP_REPOSITORY,
  type VendorLookupRepository,
} from '../../domain/repositories/vendor-lookup.repository';
import {
  VENDOR_DOCUMENT_LOOKUP_REPOSITORY,
  type VendorDocumentLookupRepository,
} from '../../domain/repositories/vendor-document-lookup.repository';
import {
  CategoryNotFoundError,
  OrganicClaimUnverifiedError,
  ProductForbiddenError,
} from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface RegisterProductInput {
  userId: string;
  categoryId: string;
  brandId: string | null;
  title: string;
  description: string | null;
  isOrganicClaim: boolean;
  organicCertDocumentId: string | null;
  ipAddress: string | null;
}

export type RegisterProductResult = ProductProps;

/**
 * POST /api/v1/vendors/me/products — FR-VND-005 + FR-PRD-002. Creates a
 * product in `draft` status, scoped to the caller's own vendor (looked up
 * via VendorLookupRepository by ownerUserId — same structural scoping
 * precedent as Vendor's GetMyVendorUseCase; vendor_staff support deferred
 * alongside staff invitations).
 *
 * THE CRITICAL RULE (BR-PRD-01, ties to BR-VND-02): if isOrganicClaim is
 * true, organicCertDocumentId must reference a vendor_documents row that
 * (a) belongs to the caller's own vendor, (b) has type organic_certificate,
 * (c) has reviewStatus approved — otherwise OrganicClaimUnverifiedError
 * (mapped to 422 BUSINESS_RULE_VIOLATION / ORGANIC_CLAIM_UNVERIFIED by the
 * interface layer). This is the cross-context rule the whole slice exists
 * to prove: Product's application layer reads Vendor's data ONLY through
 * VendorDocumentLookupRepository (a narrow port Product owns), never by
 * importing Vendor's repositories/entities directly.
 */
@Injectable()
export class RegisterProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(CATEGORY_REPOSITORY)
    private readonly categories: CategoryRepository,
    @Inject(VENDOR_LOOKUP_REPOSITORY)
    private readonly vendorLookup: VendorLookupRepository,
    @Inject(VENDOR_DOCUMENT_LOOKUP_REPOSITORY)
    private readonly vendorDocumentLookup: VendorDocumentLookupRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: RegisterProductInput): Promise<RegisterProductResult> {
    const vendor = await this.vendorLookup.findByOwnerUserId(input.userId);
    if (!vendor) {
      throw new ProductForbiddenError(
        'You must have a vendor account to create products.',
      );
    }

    const category = await this.categories.findById(input.categoryId);
    if (!category) {
      throw new CategoryNotFoundError();
    }

    if (input.isOrganicClaim) {
      await this.assertOrganicClaimVerified(
        vendor.id,
        input.organicCertDocumentId,
      );
    }

    const now = new Date();
    const product = Product.create({
      id: randomUUID(),
      vendorId: vendor.id,
      categoryId: input.categoryId,
      brandId: input.brandId,
      title: input.title,
      description: input.description,
      isOrganicClaim: input.isOrganicClaim,
      organicCertDocumentId: input.isOrganicClaim
        ? input.organicCertDocumentId
        : null,
      now,
    });

    await this.products.save(product);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'product.created',
      targetType: 'product',
      targetId: product.id,
      diff: { isOrganicClaim: input.isOrganicClaim },
      ipAddress: input.ipAddress,
    });

    return product.snapshot;
  }

  private async assertOrganicClaimVerified(
    vendorId: string,
    organicCertDocumentId: string | null,
  ): Promise<void> {
    if (!organicCertDocumentId) {
      throw new OrganicClaimUnverifiedError();
    }

    const document = await this.vendorDocumentLookup.findById(
      organicCertDocumentId,
    );

    if (
      !document ||
      document.vendorId !== vendorId ||
      document.type !== 'organic_certificate' ||
      document.reviewStatus !== 'approved'
    ) {
      throw new OrganicClaimUnverifiedError();
    }
  }
}
