// Standard error code taxonomy (API Spec Volume 07 §1.4) plus Identity
// module-specific codes (API Spec §2). New modules append their own
// module-specific codes here as they're built — one source of truth so
// the exception filter and clients never drift.

export const StandardErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const IdentityErrorCode = {
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  SESSION_REVOKED: 'SESSION_REVOKED',
} as const;

// Vendor module-specific codes (API Spec §4). VENDOR_NOT_VERIFIED is now
// used by Product Marketplace's publish use case (FR-VND-005 gating,
// reusing this existing code per the task's instruction) — VENDOR_REVOKED
// remains omitted until the revoke endpoint exists.
export const VendorErrorCode = {
  VENDOR_ALREADY_EXISTS: 'VENDOR_ALREADY_EXISTS',
  VENDOR_NOT_VERIFIED: 'VENDOR_NOT_VERIFIED',
} as const;

// Product Marketplace module-specific codes (API Spec §5).
export const ProductErrorCode = {
  SKU_TAKEN: 'SKU_TAKEN',
  ORGANIC_CLAIM_UNVERIFIED: 'ORGANIC_CLAIM_UNVERIFIED',
  REVIEW_NOT_ELIGIBLE: 'REVIEW_NOT_ELIGIBLE',
} as const;

// Orders module-specific codes (API Spec §6). ORDER_NOT_PAID and
// SHIPMENT_NOT_SHIPPED are FR-ORD-006 (vendor order fulfillment) additions
// — not in the API spec's literal error table (§6, "Module error codes:"
// list predates FR-ORD-006 implementation) but follow the same taxonomy
// (422 BUSINESS_RULE_VIOLATION-style state-machine rejections), consistent
// with the task's "pick a sensible error code consistent with existing
// Orders error codes" instruction.
// RETURN_WINDOW_EXPIRED is FR-ORD-005's one documented code (API Spec §6.4
// literal table). RETURN_NOT_REQUESTED and RETURN_ALREADY_EXISTS are
// additions beyond that literal list, same "consistent with existing Orders
// error codes" precedent as ORDER_NOT_PAID/SHIPMENT_NOT_SHIPPED were for
// FR-ORD-006 (see the comment below their definitions).
export const OrderErrorCode = {
  CART_EMPTY: 'CART_EMPTY',
  PRICE_CHANGED: 'PRICE_CHANGED',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  ORDER_ALREADY_PAID: 'ORDER_ALREADY_PAID',
  INVALID_WEBHOOK_SIGNATURE: 'INVALID_WEBHOOK_SIGNATURE',
  ORDER_NOT_PAID: 'ORDER_NOT_PAID',
  SHIPMENT_NOT_SHIPPED: 'SHIPMENT_NOT_SHIPPED',
  RETURN_WINDOW_EXPIRED: 'RETURN_WINDOW_EXPIRED',
  RETURN_NOT_REQUESTED: 'RETURN_NOT_REQUESTED',
  RETURN_ALREADY_EXISTS: 'RETURN_ALREADY_EXISTS',
} as const;

export type ErrorCode =
  | (typeof StandardErrorCode)[keyof typeof StandardErrorCode]
  | (typeof IdentityErrorCode)[keyof typeof IdentityErrorCode]
  | (typeof VendorErrorCode)[keyof typeof VendorErrorCode]
  | (typeof ProductErrorCode)[keyof typeof ProductErrorCode]
  | (typeof OrderErrorCode)[keyof typeof OrderErrorCode];
