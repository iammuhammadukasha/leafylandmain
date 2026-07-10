# Volume 04 — Database Architecture & ERDs
## (Volumes 04–06 merged for the foundation phase per Volume 00 §13)

Status: Draft v0.1
Scope: Identity, User, Vendor, Product Marketplace, Orders

---

## 1. Conventions

Applies to every table (see Volume 00 §7 for the full standard):
`id UUID PK`, `created_at`, `updated_at`, `deleted_at NULLABLE`,
`created_by`, `updated_by` (FK → users.id, nullable), `version INT`.
Omitted below for brevity — assume present on every entity table unless
marked **(no soft delete)** for pure lookup/junction tables.

All monetary columns are `BIGINT` minor units (paise). All timestamps
`TIMESTAMPTZ`. All foreign keys indexed.

## 2. Identity Context

```
users
 ├─ id (PK)
 ├─ email (unique, citext)
 ├─ email_verified_at (nullable)
 ├─ phone (nullable, unique when set)
 ├─ password_hash (nullable — null if OAuth-only)
 ├─ status (enum: active, suspended, deleted)
 └─ mfa_enabled (bool)

auth_identities                          (no soft delete)
 ├─ id (PK)
 ├─ user_id (FK → users.id)
 ├─ provider (enum: password, google, otp)
 ├─ provider_user_id (nullable, for oauth)
 └─ UNIQUE(provider, provider_user_id)

roles                                    (no soft delete, seed data)
 ├─ id (PK)
 └─ name (shopper, vendor_owner, vendor_staff, admin, super_admin)

user_roles                               (no soft delete)
 ├─ user_id (FK → users.id)
 ├─ role_id (FK → roles.id)
 ├─ vendor_id (FK → vendors.id, nullable — scopes vendor_owner/staff to one vendor)
 └─ PRIMARY KEY(user_id, role_id, vendor_id)

sessions
 ├─ id (PK)
 ├─ user_id (FK → users.id)
 ├─ refresh_token_hash
 ├─ device_label, ip_address, user_agent
 ├─ family_id (UUID — rotation chain, revoke-on-reuse detection)
 └─ revoked_at (nullable)

mfa_secrets                              (no soft delete)
 ├─ user_id (FK → users.id, unique)
 └─ totp_secret_encrypted

audit_log                                (append-only, no update/delete)
 ├─ id (PK)
 ├─ actor_user_id (FK → users.id, nullable — nullable for system actions)
 ├─ action (text, e.g. "vendor.verified")
 ├─ target_type, target_id
 ├─ diff (jsonb, nullable)
 ├─ ip_address
 └─ created_at
```

Relationships: `users 1—N sessions`, `users 1—N auth_identities`,
`users M—N roles` (via `user_roles`, optionally vendor-scoped).

## 3. User Context

```
user_profiles
 ├─ id (PK)
 ├─ user_id (FK → users.id, unique)
 ├─ full_name, avatar_url, date_of_birth (nullable)
 └─ phone_verified_at (nullable)

addresses
 ├─ id (PK)
 ├─ user_id (FK → users.id)
 ├─ type (billing, shipping)
 ├─ is_default (bool)
 ├─ line1, line2, city, state, postal_code, country
 └─ (soft-deleted, never hard-deleted — referenced by historical orders)

wishlists                                (no soft delete)
 ├─ user_id (FK → users.id)
 ├─ product_id (FK → products.id)
 ├─ added_at
 └─ PRIMARY KEY(user_id, product_id)

notification_preferences                 (no soft delete)
 ├─ user_id (FK → users.id)
 ├─ category (order_updates, account, marketing, community)
 ├─ channel (email, push)
 ├─ enabled (bool)
 └─ PRIMARY KEY(user_id, category, channel)
```

## 4. Vendor Context

```
vendors
 ├─ id (PK)
 ├─ owner_user_id (FK → users.id)
 ├─ business_name, description, logo_url, banner_url
 ├─ status (enum: pending, verified, rejected, revoked)
 ├─ commission_rate_bps (INT — basis points; overrides category default)
 └─ verified_at, rejected_reason (nullable)

vendor_documents
 ├─ id (PK)
 ├─ vendor_id (FK → vendors.id)
 ├─ type (business_registration, organic_certificate, other)
 ├─ file_url, expires_at (nullable)
 └─ review_status (enum: pending, approved, rejected)

vendor_staff_invitations
 ├─ id (PK)
 ├─ vendor_id (FK → vendors.id)
 ├─ email, role (vendor_staff), permissions (jsonb)
 ├─ status (enum: pending, accepted, revoked)
 └─ invited_by (FK → users.id)

vendor_wallet_ledger                     (append-only, no update/delete)
 ├─ id (PK)
 ├─ vendor_id (FK → vendors.id)
 ├─ order_id (FK → orders.id, nullable — null for manual adjustments)
 ├─ entry_type (credit, debit, payout)
 ├─ amount_minor (BIGINT)
 └─ created_at
```

Relationships: `vendors 1—N vendor_documents`, `vendors 1—N products`,
`vendors 1—N vendor_wallet_ledger`. `users 1—1 vendors` via
`owner_user_id` for the owning relationship; staff via `user_roles`
vendor-scoped rows.

## 5. Product Marketplace Context

```
categories
 ├─ id (PK)
 ├─ parent_id (FK → categories.id, nullable — max depth 3, enforced in app layer)
 ├─ name, slug (unique)
 └─ tax_rate_bps (INT — GST rate for this category)

brands                                   (no soft delete beyond status)
 ├─ id (PK)
 ├─ name, slug (unique)
 └─ status (enum: active, pending_review)

products
 ├─ id (PK)
 ├─ vendor_id (FK → vendors.id)
 ├─ category_id (FK → categories.id)
 ├─ brand_id (FK → brands.id, nullable)
 ├─ title, description
 ├─ is_organic_claim (bool)
 ├─ organic_cert_document_id (FK → vendor_documents.id, nullable —
 │    required when is_organic_claim = true; enforced in app layer per BR-PRD-01)
 └─ status (enum: draft, active, delisted)

product_variants
 ├─ id (PK)
 ├─ product_id (FK → products.id)
 ├─ sku (unique platform-wide)
 ├─ attributes (jsonb — e.g. {"size":"500g"})
 ├─ price_minor (BIGINT)
 ├─ stock_quantity (INT)
 └─ low_stock_threshold (INT)

offers
 ├─ id (PK)
 ├─ product_id (FK → products.id, nullable — null = platform-wide)
 ├─ discount_type (percent, flat)
 ├─ discount_value
 └─ starts_at, ends_at

coupons
 ├─ id (PK)
 ├─ vendor_id (FK → vendors.id, nullable — null = platform coupon)
 ├─ code (unique)
 ├─ discount_type, discount_value
 ├─ usage_limit, usage_count
 └─ starts_at, ends_at

reviews
 ├─ id (PK)
 ├─ product_id (FK → products.id)
 ├─ user_id (FK → users.id)
 ├─ order_line_id (FK → order_lines.id — proves purchase, enforces BR: verified buyer only)
 ├─ rating (1-5), body
 └─ UNIQUE(order_line_id) — one review per purchased line
```

Relationships: `vendors 1—N products`, `products 1—N product_variants`,
`products 1—N reviews`, `categories 1—N categories` (self-referential
tree, depth-limited in application layer).

## 6. Orders Context

```
carts
 ├─ id (PK)
 ├─ user_id (FK → users.id, nullable — nullable for guest cart, merged on login)
 └─ status (active, converted, abandoned)

cart_lines                               (no soft delete)
 ├─ cart_id (FK → carts.id)
 ├─ product_variant_id (FK → product_variants.id)
 ├─ quantity
 └─ PRIMARY KEY(cart_id, product_variant_id)

orders
 ├─ id (PK)
 ├─ user_id (FK → users.id)
 ├─ shipping_address_id (FK → addresses.id)
 ├─ billing_address_id (FK → addresses.id)
 ├─ status (enum: pending_payment, paid, shipped, delivered, cancelled, refunded)
 ├─ subtotal_minor, tax_minor, shipping_minor, total_minor (BIGINT)
 ├─ razorpay_order_id, razorpay_payment_id (nullable until paid)
 └─ paid_at (nullable — set only from verified webhook, BR-ORD-01)

order_lines
 ├─ id (PK)
 ├─ order_id (FK → orders.id)
 ├─ product_variant_id (FK → product_variants.id)
 ├─ vendor_id (FK → vendors.id — denormalized for per-vendor payout/reporting)
 ├─ quantity, unit_price_minor, tax_minor, commission_bps_snapshot (INT)
 └─ status (enum: pending, fulfilled, returned, refunded)

invoices
 ├─ id (PK)
 ├─ order_id (FK → orders.id, unique)
 ├─ invoice_number (unique, sequential per financial year)
 └─ pdf_url

shipments
 ├─ id (PK)
 ├─ order_id (FK → orders.id)
 ├─ vendor_id (FK → vendors.id — one shipment per vendor per order)
 ├─ carrier, tracking_number
 └─ status (enum: pending, shipped, delivered)

returns
 ├─ id (PK)
 ├─ order_line_id (FK → order_lines.id)
 ├─ reason, status (enum: requested, approved, rejected, refunded)
 └─ resolved_by (FK → users.id, nullable — admin/vendor who actioned it)
```

Relationships: `users 1—N orders`, `orders 1—N order_lines`,
`orders 1—1 invoices`, `orders 1—N shipments` (one per vendor in a
multi-vendor order), `order_lines 1—0..1 returns`.

## 7. Cross-Context Reference Rules

- FKs across bounded-context table groups are allowed at the DB level
  (single physical Postgres) for referential integrity, but are only ever
  **read** across context by the owning application service's public
  interface — never joined ad hoc from another module's repository. This
  keeps the DB honest (no orphaned refs) while keeping module code
  decoupled (Volume 03 §3).
- `order_lines.vendor_id` and `order_lines.commission_bps_snapshot` are
  intentional denormalizations: order history must reflect the commission
  rate and vendor at the time of sale, not whatever the Vendor context
  says today (BR-VND-01).

## 8. ERD Summary (Foundation Phase)

```
users ──1:1── vendors (owner_user_id)
users ──1:N── addresses
users ──1:N── sessions, auth_identities
users ──1:N── orders
vendors ──1:N── products ──1:N── product_variants
vendors ──1:N── vendor_documents
vendors ──1:N── vendor_wallet_ledger
products ──1:N── reviews
categories ──1:N── categories (tree)
carts ──1:N── cart_lines ──N:1── product_variants
orders ──1:N── order_lines ──N:1── product_variants
orders ──1:1── invoices
orders ──1:N── shipments
order_lines ──0:1── returns
order_lines ──0:1── reviews (via order_line_id)
```

Full entity-relationship diagram (visual, dbdiagram.io/Mermaid source) is
maintained alongside the Prisma schema once implementation begins, so it
can't drift from the real schema — this document is the authoritative
*model*, the generated diagram is a *view* of the Prisma schema.

## 9. Migration Strategy

- Prisma Migrate, one migration per PR, reviewed like code.
- No manual schema edits against any environment, including local —
  migrations are the only path, enforced by making `db push` unavailable
  outside local scratch DBs.
- Seed data (roles, categories baseline, tax rates) via a versioned seed
  script, idempotent (safe to re-run).
