/**
 * Domain-level error types. These carry no HTTP concerns (no status
 * codes) — the interface layer (or a mapping in application/) translates
 * them to AppException with the right HTTP status + error code from the
 * API spec taxonomy. Keeps domain/application free of framework types.
 */

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password.');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountLockedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Account temporarily locked due to too many failed attempts.');
    this.name = 'AccountLockedError';
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super('Session has been revoked. Please log in again.');
    this.name = 'SessionRevokedError';
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Refresh token is invalid or expired.');
    this.name = 'InvalidRefreshTokenError';
  }
}

export class InvalidVerificationTokenError extends Error {
  constructor() {
    super('Verification token is invalid or expired.');
    this.name = 'InvalidVerificationTokenError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('User not found.');
    this.name = 'UserNotFoundError';
  }
}
