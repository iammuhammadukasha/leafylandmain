import {
  ApiError,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type LoginRequest,
  type LoginResponse,
  type ProfileResponse,
  type RegisterRequest,
  type RegisterResponse,
} from './api-types';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = body as ApiErrorResponse | null;
    throw new ApiError(
      errorBody?.error?.code ?? 'UNKNOWN_ERROR',
      errorBody?.error?.message ?? `Request failed with status ${response.status}`,
      errorBody?.error?.details,
    );
  }

  return (body as ApiSuccessResponse<T>).data;
}

export const authApi = {
  register: (payload: RegisterRequest) =>
    request<RegisterResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginRequest) =>
    request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const userApi = {
  getProfile: (accessToken: string) =>
    request<ProfileResponse>('/api/v1/users/me/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};
