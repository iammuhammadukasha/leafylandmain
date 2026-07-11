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

/**
 * FR-PRD-004 / BRS §7 rule 4 — THE rule this whole reviews slice exists to
 * prove: a buyer may review a product only if they have a qualifying
 * (owned, paid) order line for that product. Maps to 422
 * BUSINESS_RULE_VIOLATION, code REVIEW_NOT_ELIGIBLE (API Spec §5.3). Thrown
 * for every distinct way eligibility can fail (line not found, line
 * belongs to someone else, line is for a different product, containing
 * order isn't paid yet) — deliberately one error type for all of these so
 * the response never leaks which specific reason applied (same "don't leak
 * why" precedent as FR-ID-001's generic registration response), since the
 * caller isn't entitled to learn "that's someone else's order line" vs
 * "that order hasn't been paid yet" as separate signals.
 */
export class ReviewNotEligibleError extends Error {
  constructor(
    message = 'You can only review a product using a paid order line you own for that product.',
  ) {
    super(message);
    this.name = 'ReviewNotEligibleError';
  }
}

/** UNIQUE(order_line_id) — one review per purchased line. Maps to 409
 * CONFLICT (same pattern as SkuTakenError). */
export class ReviewAlreadyExistsError extends Error {
  constructor() {
    super('This order line has already been reviewed.');
    this.name = 'ReviewAlreadyExistsError';
  }
}

export class QuestionNotFoundError extends Error {
  constructor() {
    super('Question not found.');
    this.name = 'QuestionNotFoundError';
  }
}

/** FR-PRD-004 — only the owning vendor's vendor_owner/vendor_staff may
 * answer a question about their product. Maps to 403 FORBIDDEN. */
export class AnswerForbiddenError extends Error {
  constructor(message = 'Only the owning vendor may answer this question.') {
    super(message);
    this.name = 'AnswerForbiddenError';
  }
}
