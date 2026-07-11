import {
  ApiError,
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type CategoryResponse,
  type CreateCategoryRequest,
  type CreateProductRequest,
  type CreateProductVariantRequest,
  type CreateVendorDocumentRequest,
  type LoginRequest,
  type LoginResponse,
  type ProductListMeta,
  type ProductResponse,
  type ProductVariantResponse,
  type ProfileResponse,
  type RegisterRequest,
  type RegisterResponse,
  type RegisterVendorRequest,
  type UpdateProductRequest,
  type UpdateVendorRequest,
  type VendorDocumentResponse,
  type VendorResponse,
  type VerifyEmailRequest,
  type VerifyEmailResponse,
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

/** Like `request`, but also returns `meta` (cursor pagination, API Spec
 * §1.3 list envelope) — needed by GET /catalog/products. */
async function requestWithMeta<T, M>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; meta: M }> {
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

  const typed = body as { data: T; meta?: M };
  return { data: typed.data, meta: typed.meta as M };
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

  verifyEmail: (payload: VerifyEmailRequest) =>
    request<VerifyEmailResponse>('/api/v1/auth/verify-email', {
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

export const vendorApi = {
  register: (accessToken: string, payload: RegisterVendorRequest) =>
    request<VendorResponse>('/api/v1/vendors', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    }),

  getMyVendor: (accessToken: string) =>
    request<VendorResponse>('/api/v1/vendors/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  updateMyVendor: (accessToken: string, payload: UpdateVendorRequest) =>
    request<VendorResponse>('/api/v1/vendors/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    }),

  // FR-VND-008 (minimal slice)
  createDocument: (accessToken: string, payload: CreateVendorDocumentRequest) =>
    request<VendorDocumentResponse>('/api/v1/vendors/me/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    }),

  listMyDocuments: (accessToken: string) =>
    request<VendorDocumentResponse[]>('/api/v1/vendors/me/documents', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};

// Product Marketplace — public catalog reads + admin category writes
// (API Spec Volume 07 §5.1/§5.2).
export const catalogApi = {
  listCategories: () =>
    request<CategoryResponse[]>('/api/v1/catalog/categories', {
      method: 'GET',
    }),

  createCategory: (accessToken: string, payload: CreateCategoryRequest) =>
    request<CategoryResponse>('/api/v1/catalog/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    }),

  listProducts: (params?: { cursor?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return requestWithMeta<ProductResponse[], ProductListMeta>(
      `/api/v1/catalog/products${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
    );
  },

  getProduct: (id: string) =>
    request<ProductResponse>(`/api/v1/catalog/products/${id}`, {
      method: 'GET',
    }),

  getProductVariants: (id: string) =>
    request<ProductVariantResponse[]>(
      `/api/v1/catalog/products/${id}/variants`,
      { method: 'GET' },
    ),
};

// Vendor-side product management (API Spec Volume 07 §5.4, FR-VND-005).
export const vendorProductApi = {
  listMyProducts: (accessToken: string) =>
    request<ProductResponse[]>('/api/v1/vendors/me/products', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  createProduct: (accessToken: string, payload: CreateProductRequest) =>
    request<ProductResponse>('/api/v1/vendors/me/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    }),

  updateProduct: (
    accessToken: string,
    id: string,
    payload: UpdateProductRequest,
  ) =>
    request<ProductResponse>(`/api/v1/vendors/me/products/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    }),

  publishProduct: (accessToken: string, id: string) =>
    request<ProductResponse>(`/api/v1/vendors/me/products/${id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  delistProduct: (accessToken: string, id: string) =>
    request<ProductResponse>(`/api/v1/vendors/me/products/${id}/delist`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }),

  createVariant: (
    accessToken: string,
    productId: string,
    payload: CreateProductVariantRequest,
  ) =>
    request<ProductVariantResponse>(
      `/api/v1/vendors/me/products/${productId}/variants`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(payload),
      },
    ),
};
