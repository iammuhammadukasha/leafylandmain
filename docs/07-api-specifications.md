# Volume 07 — API Specifications

Status: Draft v0.1
Scope: Identity, User, Vendor, Product Marketplace, Orders (foundation phase)

This volume is the binding REST contract. It does not replace generated
OpenAPI (NestJS `@nestjs/swagger` decorators are the executable source of
truth once code exists) — it is the design-time spec that implementation
must match, per Volume 00 §4 (API-first) and §12 (Definition of Done).

---

## 1. Conventions

### 1.1 Base path & versioning
All endpoints are under `/api/v1/...`. Breaking changes ship as `/api/v2`
alongside `/api/v1` until deprecation (min. 90-day overlap), never as a
silent breaking change to `v1`.

### 1.2 Auth
`Authorization: Bearer <access_token>` (JWT). Endpoints marked **Public**
require no token. Endpoints marked **Auth** require a valid access token.
Endpoints marked with a role (e.g. **vendor_owner**) require that role,
scoped to the resource per FR-ID-006.

### 1.3 Standard response envelope

Success:
```json
{ "data": { ... }, "meta": { ... } }
```
List success adds pagination meta:
```json
{ "data": [ ... ], "meta": { "nextCursor": "string|null", "count": 0 } }
```
Admin list tables (offset-based, per Volume 02 §7):
```json
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 0 } }
```

Error:
```json
{ "error": { "code": "STRING_CODE", "message": "human readable", "details": {} } }
```

### 1.4 Standard error codes

| HTTP | code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | DTO validation failed; `details` has field errors |
| 401 | `UNAUTHENTICATED` | Missing/invalid/expired token |
| 403 | `FORBIDDEN` | Authenticated but not authorized for this resource |
| 404 | `NOT_FOUND` | Resource doesn't exist or is soft-deleted |
| 409 | `CONFLICT` | State conflict (e.g., stock changed, version mismatch) |
| 422 | `BUSINESS_RULE_VIOLATION` | Passed validation but violates a BR-xxx |
| 429 | `RATE_LIMITED` | Rate limit exceeded; `details.retryAfterSeconds` |
| 500 | `INTERNAL_ERROR` | Unexpected; logged with request id, no internals leaked to client |

Module-specific codes (e.g. `ORDER_ALREADY_PAID`) extend this table in
each module's section below.

### 1.5 Pagination
Catalog/search/list-heavy endpoints: `?cursor=<opaque>&limit=<n, default 20, max 100>`.
Admin tables: `?page=<n>&pageSize=<n, default 20, max 100>`.

### 1.6 Rate limiting
Default tier: 60 req/min/user, 120 req/min/IP for anonymous. Sensitive
endpoints override per FR (noted inline). All responses include
`X-RateLimit-Remaining` / `X-RateLimit-Reset` headers.

---

## 2. Identity API

Base: `/api/v1/auth`

| Method | Path | Auth | FR | Notes |
|---|---|---|---|---|
| POST | `/register` | Public | FR-ID-001 | body: `{email, password}`. 5 req/min/IP. Always 202-style generic response. |
| POST | `/verify-email` | Public | FR-ID-001 | body: `{token}` from verification email link |
| POST | `/login` | Public | FR-ID-001 | body: `{email, password}`. Returns `{accessToken, refreshToken}` or `{mfaRequired: true, mfaToken}` if MFA enabled. 5 req/min/IP (BR-ID-03). |
| POST | `/login/mfa` | Public | FR-ID-004 | body: `{mfaToken, totpCode}` — completes login started by `/login` |
| POST | `/otp/request` | Public | FR-ID-002 | body: `{email}`. 3 req/min/IP. |
| POST | `/otp/verify` | Public | FR-ID-002 | body: `{email, code}`. Max 5 attempts (VR-ID). |
| GET | `/oauth/google` | Public | FR-ID-003 | Redirects to Google OAuth consent |
| GET | `/oauth/google/callback` | Public | FR-ID-003 | Exchanges code, links/creates identity per BR-ID-01 |
| POST | `/refresh` | Public (refresh token in body) | FR-ID-005 | body: `{refreshToken}`. Rotates token; reuse of a revoked token revokes the whole session family. |
| POST | `/logout` | Auth | FR-ID-005 | Revokes current session |
| GET | `/sessions` | Auth | FR-ID-005 | List active sessions for the caller |
| DELETE | `/sessions/:sessionId` | Auth | FR-ID-005 | Revoke a specific session (must belong to caller) |
| POST | `/mfa/enroll` | Auth | FR-ID-004 | Returns TOTP secret + QR payload |
| POST | `/mfa/confirm` | Auth | FR-ID-004 | body: `{totpCode}` — activates MFA |
| POST | `/mfa/disable` | Auth | FR-ID-004 | Requires current TOTP code to disable |

Module error codes: `EMAIL_NOT_VERIFIED`, `MFA_REQUIRED`,
`INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `OTP_EXPIRED`,
`OTP_MAX_ATTEMPTS`, `SESSION_REVOKED`.

Every endpoint in this section writes to `audit_log` per FR-ID-007 —
this is enforced in the application layer, not repeated per-row below.

---

## 3. User API

Base: `/api/v1/users/me`

| Method | Path | Auth | FR |
|---|---|---|---|
| GET | `/profile` | Auth | FR-USR-001 |
| PATCH | `/profile` | Auth | FR-USR-001 |
| POST | `/profile/phone/verify/request` | Auth | FR-USR-001 (reuses OTP, FR-ID-002) |
| POST | `/profile/phone/verify/confirm` | Auth | FR-USR-001 |
| GET | `/addresses` | Auth | FR-USR-002 |
| POST | `/addresses` | Auth | FR-USR-002 |
| PATCH | `/addresses/:id` | Auth | FR-USR-002 |
| DELETE | `/addresses/:id` | Auth | FR-USR-002 — soft delete if referenced by an order |
| GET | `/wishlist` | Auth | FR-USR-003 |
| PUT | `/wishlist/:productId` | Auth | FR-USR-003 — idempotent add |
| DELETE | `/wishlist/:productId` | Auth | FR-USR-003 |
| GET | `/orders` | Auth | FR-USR-004 — summary view; full detail via Orders API `/orders/:id` |
| GET | `/notification-preferences` | Auth | FR-USR-005 |
| PUT | `/notification-preferences` | Auth | FR-USR-005 — body: array of `{category, channel, enabled}`; rejects disabling transactional categories (BR-USR-01 → `BUSINESS_RULE_VIOLATION`) |
| POST | `/privacy/export-request` | Auth | FR-USR-006 |
| POST | `/privacy/deletion-request` | Auth | FR-USR-006 — emits `EV-USR-003`, does not delete synchronously |

---

## 4. Vendor API

Base: `/api/v1/vendors`

### 4.1 Registration & verification

| Method | Path | Auth | FR |
|---|---|---|---|
| POST | `/` | Auth | FR-VND-001 — creates vendor in `pending` status |
| GET | `/me` | vendor_owner/vendor_staff | Own vendor detail, scoped per FR-ID-006 |
| PATCH | `/me` | vendor_owner | FR-VND-003 — store profile/policies |
| POST | `/me/documents` | vendor_owner | FR-VND-008 — multipart upload → S3, creates `vendor_documents` row `pending` |
| GET | `/me/documents` | vendor_owner/vendor_staff | FR-VND-008 |
| POST | `/:vendorId/verify` | admin | FR-VND-002 — body: `{decision: "approved"\|"rejected"\|"more_info", reason?}` |
| POST | `/:vendorId/revoke` | admin | BR-VND-03 — body: `{reason}` |

### 4.2 Staff

| Method | Path | Auth | FR |
|---|---|---|---|
| POST | `/me/staff/invite` | vendor_owner | FR-VND-004 — body: `{email, permissions}` |
| GET | `/me/staff` | vendor_owner | FR-VND-004 |
| PATCH | `/me/staff/:userId` | vendor_owner | FR-VND-004 — update permissions |
| DELETE | `/me/staff/:userId` | vendor_owner | FR-VND-004 — revoke |
| POST | `/staff/invitations/:id/accept` | Auth (invited user) | FR-VND-004 |

### 4.3 Wallet & commissions

| Method | Path | Auth | FR |
|---|---|---|---|
| GET | `/me/wallet/ledger` | vendor_owner | FR-VND-006 — paginated ledger entries |
| GET | `/me/wallet/balance` | vendor_owner/vendor_staff | FR-VND-006 |
| PATCH | `/:vendorId/commission-rate` | admin | FR-VND-006 — negotiated override; BR-VND-01 (forward-only) |

### 4.4 Analytics

| Method | Path | Auth | FR |
|---|---|---|---|
| GET | `/me/analytics/sales?from=&to=` | vendor_owner/vendor_staff | FR-VND-007 |

Module error codes: `VENDOR_NOT_VERIFIED`, `VENDOR_REVOKED`,
`DOCUMENT_TYPE_REQUIRED`, `STAFF_INVITE_ALREADY_PENDING`.

Product/inventory endpoints for vendors (FR-VND-005) are documented under
Product Marketplace §5.4 below — a vendor "manages" products through the
same product resource the storefront reads, scoped by ownership, rather
than a duplicate vendor-side product API.

---

## 5. Product Marketplace API

Base: `/api/v1/catalog`

### 5.1 Categories & brands (public reads, admin writes)

| Method | Path | Auth | FR |
|---|---|---|---|
| GET | `/categories` | Public | FR-PRD-001 — tree, cached (Volume 03 §7.3) |
| POST | `/categories` | admin | FR-PRD-001 |
| PATCH | `/categories/:id` | admin | FR-PRD-001 |
| GET | `/brands` | Public | FR-PRD-001 |
| POST | `/brands/request` | vendor_owner | FR-PRD-001 — creates `pending_review` brand |
| POST | `/brands/:id/approve` | admin | FR-PRD-001 |

### 5.2 Products & variants (public reads)

| Method | Path | Auth | FR |
|---|---|---|---|
| GET | `/products` | Public | FR-PRD-005 — query params: `category, brand, priceMin, priceMax, organicOnly, rating, q, cursor, limit`; backed by OpenSearch |
| GET | `/products/:id` | Public | FR-PRD-002 |
| GET | `/products/:id/variants` | Public | FR-PRD-002 |
| GET | `/products/:id/similar` | Public | FR-PRD-006 |
| GET | `/products/:id/frequently-bought-together` | Public | FR-PRD-006 |
| POST | `/products/compare?ids=a,b,c,d` | Public | FR-PRD-007 — max 4 ids, `VALIDATION_ERROR` above that |

### 5.3 Reviews & Q&A

| Method | Path | Auth | FR |
|---|---|---|---|
| GET | `/products/:id/reviews` | Public | FR-PRD-004 |
| POST | `/products/:id/reviews` | Auth | FR-PRD-004 — body: `{orderLineId, rating, body}`. Server verifies `orderLineId` belongs to caller and is fulfilled → else `BUSINESS_RULE_VIOLATION` (`REVIEW_NOT_ELIGIBLE`) |
| GET | `/products/:id/questions` | Public | FR-PRD-004 |
| POST | `/products/:id/questions` | Auth | FR-PRD-004 |
| POST | `/questions/:id/answers` | vendor_owner/vendor_staff (owning vendor only) | FR-PRD-004 |

### 5.4 Vendor-side product management

Base: `/api/v1/vendors/me/products`

| Method | Path | Auth | FR |
|---|---|---|---|
| GET | `/` | vendor_owner/vendor_staff | FR-VND-005 |
| POST | `/` | vendor_owner/vendor_staff | FR-VND-005, FR-PRD-002 — creates `draft` product; `isOrganicClaim=true` requires `organicCertDocumentId` referencing an *approved* document (BR-PRD-01) else `422 BUSINESS_RULE_VIOLATION (ORGANIC_CLAIM_UNVERIFIED)` |
| PATCH | `/:id` | vendor_owner/vendor_staff | FR-VND-005 |
| POST | `/:id/publish` | vendor_owner/vendor_staff | FR-VND-005 — `draft → active`, requires verified vendor (`VENDOR_NOT_VERIFIED` otherwise) |
| POST | `/:id/delist` | vendor_owner/vendor_staff | FR-VND-005 |
| POST | `/:id/variants` | vendor_owner/vendor_staff | FR-VND-005 — SKU uniqueness enforced, `409 CONFLICT (SKU_TAKEN)` |
| PATCH | `/variants/:variantId` | vendor_owner/vendor_staff | FR-VND-005 |
| PATCH | `/variants/:variantId/stock` | vendor_owner/vendor_staff | FR-VND-005 — emits `EV-PRD-003` when below `lowStockThreshold` |

### 5.5 Offers & coupons

| Method | Path | Auth | FR |
|---|---|---|---|
| POST | `/vendors/me/products/:id/offers` | vendor_owner | FR-PRD-003 |
| GET | `/products/:id/offers` | Public | FR-PRD-003 — active offers only |
| POST | `/coupons` | vendor_owner or admin (platform-wide) | FR-PRD-003 |
| POST | `/coupons/:code/validate` | Auth | FR-PRD-003 — body: `{cartId}`; returns discount preview, enforces stacking rule |

Module error codes: `SKU_TAKEN`, `ORGANIC_CLAIM_UNVERIFIED`,
`REVIEW_NOT_ELIGIBLE`, `COUPON_EXPIRED`, `COUPON_STACK_LIMIT`.

---

## 6. Orders API

Base: `/api/v1/orders`

### 6.1 Cart

| Method | Path | Auth | FR |
|---|---|---|---|
| GET | `/cart` | Public (guest cart via cookie/id) or Auth | FR-ORD-001 |
| POST | `/cart/lines` | Public/Auth | FR-ORD-001 — body: `{productVariantId, quantity}` |
| PATCH | `/cart/lines/:variantId` | Public/Auth | FR-ORD-001 |
| DELETE | `/cart/lines/:variantId` | Public/Auth | FR-ORD-001 |
| POST | `/cart/merge` | Auth | FR-ORD-001 — merges guest cart into user cart on login |

### 6.2 Checkout & payment

| Method | Path | Auth | FR |
|---|---|---|---|
| POST | `/checkout/quote` | Auth | FR-ORD-002, FR-ORD-007 — re-validates price/stock, computes tax/shipping, does not create an order yet |
| POST | `/checkout` | Auth | FR-ORD-002 — body: `{cartId, shippingAddressId, billingAddressId, shippingMethod, couponCode?}`; creates `pending_payment` order + Razorpay payment order, returns `{orderId, razorpayOrderId, amount}` |
| POST | `/webhooks/razorpay` | **Public, signature-verified** | FR-ORD-003, BR-ORD-01 — the only path that can set `order.status = paid`. Verifies `X-Razorpay-Signature` against raw body before trusting payload. |
| GET | `/:orderId` | Auth (owner) or admin | FR-ORD-002 |
| GET | `/:orderId/invoice` | Auth (owner) or admin | FR-ORD-004 — returns signed S3 URL to PDF |

Note on `/webhooks/razorpay`: excluded from the standard JWT auth
middleware but subject to its own mandatory signature verification
middleware — "Public" here means "no user session," not "unauthenticated."
Requests with an invalid signature are rejected `401` and logged as a
security event, not merely ignored.

### 6.3 Vendor order fulfillment

Base: `/api/v1/vendors/me/orders`

| Method | Path | Auth | FR |
|---|---|---|---|
| GET | `/` | vendor_owner/vendor_staff | FR-ORD-006 — order lines belonging to this vendor only |
| POST | `/:orderLineId/ship` | vendor_owner/vendor_staff | FR-ORD-006 — body: `{carrier, trackingNumber}`, creates/updates `shipments` |
| POST | `/:orderLineId/deliver` | vendor_owner/vendor_staff | FR-ORD-006 |

### 6.4 Returns & refunds

| Method | Path | Auth | FR |
|---|---|---|---|
| POST | `/lines/:orderLineId/return` | Auth (buyer) | FR-ORD-005 — body: `{reason}`; rejected outside policy window → `422 (RETURN_WINDOW_EXPIRED)` |
| POST | `/returns/:id/approve` | vendor_owner/vendor_staff or admin | FR-ORD-005 — triggers Razorpay refund |
| POST | `/returns/:id/reject` | vendor_owner/vendor_staff or admin | FR-ORD-005 — body: `{reason}` |

Module error codes: `CART_EMPTY`, `PRICE_CHANGED`, `OUT_OF_STOCK`,
`ORDER_ALREADY_PAID`, `INVALID_WEBHOOK_SIGNATURE`,
`RETURN_WINDOW_EXPIRED`.

---

## 7. Admin API (thin, foundation phase)

Base: `/api/v1/admin`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/users` | admin | Paginated, offset-based per Volume 02 §7 |
| PATCH | `/users/:id/status` | admin | Suspend/reactivate; audit-logged |
| GET | `/vendors?status=pending` | admin | Verification queue — delegates to Vendor API §4.1 for the actual decision |
| GET | `/orders` | admin | Cross-vendor order oversight |
| GET | `/audit-log` | super_admin | Read-only, paginated, filterable by actor/action/date |

Per Volume 03 §3, this module invokes the same application services as
the owning contexts (Vendor's verify use case, etc.) — it does not
reimplement business rules.

---

## 8. Idempotency

`POST` endpoints that create a payment-adjacent resource (`/checkout`,
returns/refund actions) accept an optional `Idempotency-Key` header;
replaying the same key returns the original response instead of creating
a duplicate resource. Required for `/checkout` specifically given
Razorpay retry behavior on flaky networks.

## 9. OpenAPI Generation

Once implementation begins, every controller method carries
`@ApiOperation`, `@ApiResponse` (including error envelope shapes), and DTO
`@ApiProperty` decorators, and CI fails if `npm run openapi:generate`
produces a diff not committed alongside the PR — this file and the
generated spec must never silently diverge past that check.
