/**
 * Port for the email verification token used by the FR-ID-001 register ->
 * verify-email flow. The stub implementation is a signed, expiring token
 * (no real email delivery — Constitution: don't hand-roll crypto, but a
 * signed JWT-style token via @nestjs/jwt is the platform's own Identity
 * Platform primitive, not third-party auth, so it's in-bounds).
 */
export interface EmailVerificationTokenPayload {
  userId: string;
  email: string;
}

export interface EmailVerificationTokenService {
  generate(payload: EmailVerificationTokenPayload): string;
  /** Returns the payload if the token is valid and unexpired, otherwise
   * null — never throws for an invalid token, so the caller doesn't need
   * try/catch to implement AC "generic response" behavior. */
  verify(token: string): EmailVerificationTokenPayload | null;
}

export const EMAIL_VERIFICATION_TOKEN_SERVICE = Symbol(
  'EMAIL_VERIFICATION_TOKEN_SERVICE',
);
