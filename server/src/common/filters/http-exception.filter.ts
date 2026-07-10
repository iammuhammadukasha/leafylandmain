import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { AppException } from '../errors/app.exception';
import { StandardErrorCode } from '../errors/error-codes';
import type { ApiErrorResponse } from '../dto/api-response.dto';

/**
 * Global exception filter — the single place that renders the standard
 * error envelope (API Spec Volume 07 §1.3/§1.4) for every thrown error in
 * the app: AppException (business/application errors), ValidationPipe
 * failures, ThrottlerException (rate limiting), NestJS HttpExceptions, and
 * anything unexpected (mapped to INTERNAL_ERROR, no internals leaked).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, body } = this.resolve(exception);

    this.logger.log(
      JSON.stringify({
        requestId: request.headers['x-request-id'] ?? null,
        method: request.method,
        path: request.url,
        status,
        code: body.error.code,
        outcome: 'error',
      }),
    );

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: HttpStatus;
    body: ApiErrorResponse;
  } {
    if (exception instanceof AppException) {
      return {
        status: exception.getStatus(),
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            details: exception.details,
          },
        },
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: {
          error: {
            code: StandardErrorCode.RATE_LIMITED,
            message: 'Too many requests. Please try again later.',
            details: undefined,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      return {
        status,
        body: {
          error: {
            code: this.codeForHttpStatus(status),
            message: this.messageFromPayload(payload, exception.message),
            details: this.detailsFromPayload(payload),
          },
        },
      };
    }

    // Unexpected/unhandled error — never leak internals to the client.
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: StandardErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred.',
          details: undefined,
        },
      },
    };
  }

  private codeForHttpStatus(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return StandardErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return StandardErrorCode.UNAUTHENTICATED;
      case HttpStatus.FORBIDDEN:
        return StandardErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return StandardErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return StandardErrorCode.CONFLICT;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return StandardErrorCode.BUSINESS_RULE_VIOLATION;
      case HttpStatus.TOO_MANY_REQUESTS:
        return StandardErrorCode.RATE_LIMITED;
      default:
        return StandardErrorCode.INTERNAL_ERROR;
    }
  }

  private messageFromPayload(payload: unknown, fallback: string): string {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload
    ) {
      const msg = payload.message;
      if (typeof msg === 'string') return msg;
      if (Array.isArray(msg)) return msg.join('; ');
    }
    return fallback;
  }

  private detailsFromPayload(
    payload: unknown,
  ): Record<string, unknown> | undefined {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      Array.isArray(payload.message)
    ) {
      return { fieldErrors: (payload as { message: string[] }).message };
    }
    return undefined;
  }
}
