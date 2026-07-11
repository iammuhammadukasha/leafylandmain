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
} as const;

export type ErrorCode =
  | (typeof StandardErrorCode)[keyof typeof StandardErrorCode]
  | (typeof IdentityErrorCode)[keyof typeof IdentityErrorCode]
  | (typeof VendorErrorCode)[keyof typeof VendorErrorCode]
  | (typeof ProductErrorCode)[keyof typeof ProductErrorCode];
