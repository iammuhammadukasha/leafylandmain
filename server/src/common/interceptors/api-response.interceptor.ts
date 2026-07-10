import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { ApiSuccessResponse } from '../dto/api-response.dto';

/**
 * Wraps every successful controller response in the standard envelope
 * (API Spec Volume 07 §1.3): `{ data, meta }`. Controllers return plain
 * DTOs/values; this is the single place the envelope shape lives, so
 * every module gets it uniformly without repeating wrapping logic.
 *
 * A controller may return `{ __meta, ...rest }` shaped result via the
 * `ApiPaginated` helper (not needed for this slice — no list endpoints
 * yet) to control the `meta` field explicitly; otherwise `meta` is
 * omitted.
 */
@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          '__envelope' in (data as Record<string, unknown>)
        ) {
          const { data: payload, meta } = data as unknown as {
            __envelope: true;
            data: T;
            meta?: Record<string, unknown>;
          };
          return meta !== undefined
            ? { data: payload, meta }
            : { data: payload };
        }
        return { data };
      }),
    );
  }
}
