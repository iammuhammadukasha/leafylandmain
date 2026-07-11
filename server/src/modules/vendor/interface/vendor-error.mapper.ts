import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import {
  StandardErrorCode,
  VendorErrorCode,
} from '../../../common/errors/error-codes';
import {
  VendorAlreadyExistsError,
  VendorDocumentNotFoundError,
  VendorForbiddenError,
  VendorNotFoundError,
} from '../domain/errors/vendor.errors';

/**
 * Translates domain/application errors thrown by Vendor use cases into the
 * standard AppException (HTTP status + error code envelope, API Spec
 * §1.4). Same pattern as Identity's `identity-error.mapper.ts` — keeps use
 * cases framework-agnostic while controllers stay thin.
 */
export function mapVendorError(error: unknown): AppException {
  if (error instanceof VendorAlreadyExistsError) {
    return new AppException(
      VendorErrorCode.VENDOR_ALREADY_EXISTS,
      error.message,
      HttpStatus.CONFLICT,
    );
  }
  if (error instanceof VendorNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof VendorDocumentNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof VendorForbiddenError) {
    return new AppException(
      StandardErrorCode.FORBIDDEN,
      error.message,
      HttpStatus.FORBIDDEN,
    );
  }

  // Unknown error: rethrow to let the global exception filter map it to
  // INTERNAL_ERROR rather than masking it as a 4xx here.
  throw error;
}
