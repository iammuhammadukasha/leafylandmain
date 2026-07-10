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

export type ErrorCode =
  | (typeof StandardErrorCode)[keyof typeof StandardErrorCode]
  | (typeof IdentityErrorCode)[keyof typeof IdentityErrorCode];
