import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import {
  IdentityErrorCode,
  StandardErrorCode,
} from '../../../common/errors/error-codes';
import {
  AccountLockedError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidVerificationTokenError,
  SessionRevokedError,
  UserNotFoundError,
} from '../domain/errors/identity.errors';

/**
 * Translates domain/application errors thrown by Identity use cases into
 * the standard AppException (HTTP status + error code envelope, API Spec
 * §1.4). Keeps the mapping in one place in the interface layer, so use
 * cases stay framework-agnostic (Architecture §4) while controllers stay
 * thin (Constitution §6 — no business logic in controllers).
 */
export function mapIdentityError(error: unknown): AppException {
  if (error instanceof InvalidCredentialsError) {
    return new AppException(
      IdentityErrorCode.INVALID_CREDENTIALS,
      error.message,
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (error instanceof AccountLockedError) {
    return new AppException(
      IdentityErrorCode.ACCOUNT_LOCKED,
      error.message,
      HttpStatus.FORBIDDEN,
      { retryAfterSeconds: error.retryAfterSeconds },
    );
  }
  if (error instanceof SessionRevokedError) {
    return new AppException(
      IdentityErrorCode.SESSION_REVOKED,
      error.message,
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (error instanceof InvalidRefreshTokenError) {
    return new AppException(
      StandardErrorCode.UNAUTHENTICATED,
      error.message,
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (error instanceof InvalidVerificationTokenError) {
    return new AppException(
      StandardErrorCode.VALIDATION_ERROR,
      error.message,
      HttpStatus.BAD_REQUEST,
    );
  }
  if (error instanceof UserNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }

  // Unknown error: rethrow to let the global exception filter map it to
  // INTERNAL_ERROR rather than masking it as a 4xx here.
  throw error;
}
