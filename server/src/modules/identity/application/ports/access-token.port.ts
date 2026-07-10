/**
 * Port for signing/verifying JWT access tokens.
 *
 * DECISION (not specified by API Spec §2, minimal reasonable choice):
 * access token claims = { sub: userId, email, roles: string[] }. `sub` is
 * the standard JWT subject claim; `roles` is included so downstream RBAC
 * checks (FR-ID-006, out of scope for this slice) don't require a DB hit
 * per request once implemented. No other PII is embedded in the token.
 */
export interface AccessTokenClaims {
  sub: string;
  email: string;
  roles: string[];
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): string;
  verify(token: string): AccessTokenClaims | null;
}

export const ACCESS_TOKEN_SERVICE = Symbol('ACCESS_TOKEN_SERVICE');
