// Types mirroring the standard response envelope (API Spec Volume 07
// §1.3/§1.4) — kept in sync by hand for this scaffold; once the backend's
// generated OpenAPI spec exists, these can be replaced with a generated
// client (Constitution §4: API-first).

export interface ApiSuccessResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ProfileResponse {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  phoneVerifiedAt: string | null;
  emailVerifiedAt: string | null;
}
