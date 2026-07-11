import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import {
  ProductErrorCode,
  StandardErrorCode,
  VendorErrorCode,
} from '../../../common/errors/error-codes';
import {
  AnswerForbiddenError,
  CategoryDepthExceededError,
  CategoryNotFoundError,
  CategorySlugTakenError,
  OrganicClaimUnverifiedError,
  ProductForbiddenError,
  ProductNotFoundError,
  ProductVariantNotFoundError,
  QuestionNotFoundError,
  ReviewAlreadyExistsError,
  ReviewNotEligibleError,
  SkuTakenError,
  VendorNotVerifiedError,
} from '../domain/errors/product.errors';

/**
 * Translates domain/application errors thrown by Product use cases into
 * the standard AppException (HTTP status + error code envelope, API Spec
 * §1.4). Same pattern as Vendor's `vendor-error.mapper.ts`.
 */
export function mapProductError(error: unknown): AppException {
  if (error instanceof CategoryNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof CategoryDepthExceededError) {
    return new AppException(
      StandardErrorCode.BUSINESS_RULE_VIOLATION,
      error.message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (error instanceof CategorySlugTakenError) {
    return new AppException(
      StandardErrorCode.CONFLICT,
      error.message,
      HttpStatus.CONFLICT,
    );
  }
  if (error instanceof ProductNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof ProductVariantNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof ProductForbiddenError) {
    return new AppException(
      StandardErrorCode.FORBIDDEN,
      error.message,
      HttpStatus.FORBIDDEN,
    );
  }
  if (error instanceof OrganicClaimUnverifiedError) {
    return new AppException(
      ProductErrorCode.ORGANIC_CLAIM_UNVERIFIED,
      error.message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (error instanceof VendorNotVerifiedError) {
    return new AppException(
      VendorErrorCode.VENDOR_NOT_VERIFIED,
      error.message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (error instanceof SkuTakenError) {
    return new AppException(
      ProductErrorCode.SKU_TAKEN,
      error.message,
      HttpStatus.CONFLICT,
    );
  }
  if (error instanceof ReviewNotEligibleError) {
    return new AppException(
      ProductErrorCode.REVIEW_NOT_ELIGIBLE,
      error.message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (error instanceof ReviewAlreadyExistsError) {
    return new AppException(
      StandardErrorCode.CONFLICT,
      error.message,
      HttpStatus.CONFLICT,
    );
  }
  if (error instanceof QuestionNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof AnswerForbiddenError) {
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
