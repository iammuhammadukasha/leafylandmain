import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import {
  OrderErrorCode,
  StandardErrorCode,
} from '../../../common/errors/error-codes';
import {
  AddressForbiddenError,
  AddressNotFoundError,
  CartEmptyError,
  CartLineNotFoundError,
  InvalidWebhookSignatureError,
  OrderAlreadyPaidError,
  OrderForbiddenError,
  OrderNotFoundError,
  OutOfStockError,
  ProductVariantNotAvailableError,
} from '../domain/errors/order.errors';

/**
 * Translates domain/application errors thrown by Orders use cases into
 * the standard AppException (HTTP status + error code envelope, API Spec
 * §1.4). Same pattern as Product's `product-error.mapper.ts` / Vendor's
 * `vendor-error.mapper.ts`.
 */
export function mapOrderError(error: unknown): AppException {
  if (error instanceof CartLineNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof ProductVariantNotAvailableError) {
    return new AppException(
      StandardErrorCode.BUSINESS_RULE_VIOLATION,
      error.message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (error instanceof CartEmptyError) {
    return new AppException(
      OrderErrorCode.CART_EMPTY,
      error.message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (error instanceof OutOfStockError) {
    return new AppException(
      OrderErrorCode.OUT_OF_STOCK,
      error.message,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
  if (error instanceof AddressNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof AddressForbiddenError) {
    // Deliberately mapped to the SAME 404 as AddressNotFoundError, not a
    // distinct 403 — this is the no-leak pattern: an address id that
    // exists but belongs to someone else should look identical to an id
    // that doesn't exist at all (same rationale as GetOrderUseCase's
    // owner-only check, which uses 403 for orders because an order's own
    // GET endpoint is documented as owner-only by API Spec §6.2 — the
    // two cases differ because leaking "an order with this id exists" is
    // explicitly tolerated there per that endpoint's spec, but leaking
    // "an address with this id exists" during checkout is not something
    // any endpoint needs to reveal).
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      'Address not found.',
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof OrderNotFoundError) {
    return new AppException(
      StandardErrorCode.NOT_FOUND,
      error.message,
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof OrderForbiddenError) {
    return new AppException(
      StandardErrorCode.FORBIDDEN,
      error.message,
      HttpStatus.FORBIDDEN,
    );
  }
  if (error instanceof OrderAlreadyPaidError) {
    return new AppException(
      OrderErrorCode.ORDER_ALREADY_PAID,
      error.message,
      HttpStatus.CONFLICT,
    );
  }
  if (error instanceof InvalidWebhookSignatureError) {
    return new AppException(
      OrderErrorCode.INVALID_WEBHOOK_SIGNATURE,
      error.message,
      HttpStatus.UNAUTHORIZED,
    );
  }

  // Unknown error: rethrow to let the global exception filter map it to
  // INTERNAL_ERROR rather than masking it as a 4xx here.
  throw error;
}
