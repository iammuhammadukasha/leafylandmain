// Standard response envelope shapes (API Spec Volume 07 §1.3).
// These are documentation/typing helpers used by the interceptor and by
// controllers' @ApiResponse annotations — not DTOs validated on input.

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiListMeta {
  nextCursor: string | null;
  count: number;
}

export interface ApiOffsetListMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}
