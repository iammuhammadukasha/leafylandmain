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

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
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

// Vendor module (API Spec Volume 07 §4) — registration/store-profile slice.
export interface RegisterVendorRequest {
  businessName: string;
  description?: string;
}

export type VendorStatus = 'pending' | 'verified' | 'rejected' | 'revoked';

export interface VendorResponse {
  id: string;
  ownerUserId: string;
  businessName: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  status: VendorStatus;
  commissionRateBps: number | null;
  verifiedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateVendorRequest {
  businessName?: string;
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

// Vendor documents (API Spec Volume 07 §4.1, FR-VND-008 minimal slice).
export type VendorDocumentType =
  | 'business_registration'
  | 'organic_certificate'
  | 'other';

export type VendorDocumentReviewStatus = 'pending' | 'approved' | 'rejected';

export interface CreateVendorDocumentRequest {
  type: VendorDocumentType;
  fileUrl: string;
  expiresAt?: string;
}

export interface VendorDocumentResponse {
  id: string;
  vendorId: string;
  type: VendorDocumentType;
  fileUrl: string;
  reviewStatus: VendorDocumentReviewStatus;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Product Marketplace module (API Spec Volume 07 §5) — categories/
// products/variants vertical slice.
export interface CategoryResponse {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  taxRateBps: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryRequest {
  parentId?: string | null;
  name: string;
  slug: string;
  taxRateBps: number;
}

export type ProductStatus = 'draft' | 'active' | 'delisted';

export interface ProductResponse {
  id: string;
  vendorId: string;
  categoryId: string;
  brandId: string | null;
  title: string;
  description: string | null;
  isOrganicClaim: boolean;
  organicCertDocumentId: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  categoryId: string;
  brandId?: string | null;
  title: string;
  description?: string;
  isOrganicClaim: boolean;
  organicCertDocumentId?: string;
}

export interface UpdateProductRequest {
  categoryId?: string;
  brandId?: string | null;
  title?: string;
  description?: string | null;
}

export interface ProductVariantResponse {
  id: string;
  productId: string;
  sku: string;
  attributes: Record<string, unknown>;
  priceMinor: string;
  stockQuantity: number;
  lowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductVariantRequest {
  sku: string;
  attributes?: Record<string, unknown>;
  priceMinor: number;
  stockQuantity: number;
  lowStockThreshold: number;
}

export interface ProductListMeta {
  nextCursor: string | null;
  count: number;
}

export interface ProductListResponse {
  items: ProductResponse[];
  meta: ProductListMeta;
}

// Orders module (API Spec Volume 07 §6) — cart/checkout/webhook-payment
// vertical slice (FR-ORD-001/002/003, BR-ORD-01). Deferred vs the full
// spec: guest cart, invoices, shipments/returns, coupons, full GST — see
// server/prisma/schema.prisma's Orders context header comment for the
// complete deferred list.
export type CartStatus = 'active' | 'converted' | 'abandoned';

export interface CartLineResponse {
  productVariantId: string;
  quantity: number;
}

export interface CartResponse {
  id: string;
  userId: string;
  status: CartStatus;
  lines: CartLineResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface AddCartLineRequest {
  productVariantId: string;
  quantity: number;
}

export interface UpdateCartLineRequest {
  quantity: number;
}

export interface QuotedLineResponse {
  productVariantId: string;
  sku: string;
  quantity: number;
  unitPriceMinor: string;
  lineSubtotalMinor: string;
  lineTaxMinor: string;
  categoryTaxRateBps: number;
}

export interface CheckoutQuoteResponse {
  lines: QuotedLineResponse[];
  subtotalMinor: string;
  taxMinor: string;
  shippingMinor: string;
  totalMinor: string;
}

export interface CheckoutRequest {
  shippingAddressId: string;
  billingAddressId: string;
}

export interface CheckoutResponse {
  orderId: string;
  gatewayOrderId: string;
  amountMinor: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface OrderLineResponse {
  id: string;
  productVariantId: string;
  vendorId: string;
  quantity: number;
  unitPriceMinor: string;
  taxMinor: string;
  status: 'pending' | 'fulfilled' | 'returned' | 'refunded';
}

export interface OrderResponse {
  id: string;
  userId: string;
  shippingAddressId: string;
  billingAddressId: string;
  status: OrderStatus;
  subtotalMinor: string;
  taxMinor: string;
  shippingMinor: string;
  totalMinor: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  lines: OrderLineResponse[];
  createdAt: string;
}
