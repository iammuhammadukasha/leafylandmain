/**
 * Domain-level error types. These carry no HTTP concerns (no status
 * codes) — the interface layer maps them to AppException with the right
 * HTTP status + error code from the API spec taxonomy. Keeps
 * domain/application free of framework types. Mirrors Vendor's
 * `vendor.errors.ts` pattern.
 */

export class CategoryNotFoundError extends Error {
  constructor() {
    super('Category not found.');
    this.name = 'CategoryNotFoundError';
  }
}

export class CategoryDepthExceededError extends Error {
  constructor() {
    super('Categories may be nested at most 3 levels deep.');
    this.name = 'CategoryDepthExceededError';
  }
}

export class CategorySlugTakenError extends Error {
  constructor() {
    super('A category with this slug already exists.');
    this.name = 'CategorySlugTakenError';
  }
}

export class ProductNotFoundError extends Error {
  constructor() {
    super('Product not found.');
    this.name = 'ProductNotFoundError';
  }
}

export class ProductForbiddenError extends Error {
  constructor(message = 'You are not authorized to perform this action.') {
    super(message);
    this.name = 'ProductForbiddenError';
  }
}

/** BR-PRD-01 / BR-VND-02 — organic claim without an approved certification
 * document on file. Maps to 422 BUSINESS_RULE_VIOLATION,
 * code ORGANIC_CLAIM_UNVERIFIED (API Spec §5.4). */
export class OrganicClaimUnverifiedError extends Error {
  constructor(
    message = 'An approved organic_certificate document is required to list a product with an organic claim.',
  ) {
    super(message);
    this.name = 'OrganicClaimUnverifiedError';
  }
}

/** FR-VND-005 publish gating — reuses the Vendor module's existing
 * VENDOR_NOT_VERIFIED error code (API Spec §4, reused per §5.4's publish
 * endpoint note) rather than inventing a new one. */
export class VendorNotVerifiedError extends Error {
  constructor(message = 'Only a verified vendor can publish products.') {
    super(message);
    this.name = 'VendorNotVerifiedError';
  }
}

export class ProductVariantNotFoundError extends Error {
  constructor() {
    super('Product variant not found.');
    this.name = 'ProductVariantNotFoundError';
  }
}

/** VR-PRD — every SKU is unique platform-wide. Maps to 409 CONFLICT, code
 * SKU_TAKEN (API Spec §5.4). */
export class SkuTakenError extends Error {
  constructor() {
    super('This SKU is already in use.');
    this.name = 'SkuTakenError';
  }
}
