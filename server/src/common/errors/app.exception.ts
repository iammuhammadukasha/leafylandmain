import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

/**
 * Application-level exception carrying the standard error envelope fields
 * (API Spec Volume 07 §1.4). Application/use-case layers throw this (or a
 * subclass) instead of NestJS's HttpException directly, so the domain and
 * application layers stay framework-agnostic in spirit — this is the one
 * deliberate exception, since the error *code* taxonomy is itself part of
 * the API contract, not a framework detail. The interface layer never
 * needs to translate codes; the global filter renders the envelope.
 */
export class AppException extends HttpException {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}
