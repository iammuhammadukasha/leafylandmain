# Volume 02 — Software Requirements Specification (SRS)
## Book 01: Core Platform — Identity, User, Vendor, Product Marketplace

Status: Draft v0.1

This volume is the implementation contract. Each requirement is
independently testable and traceable to a BRS business rule or goal
(Volume 01). AI coding agents implementing a feature should treat the
matching FR/AC pair here as the spec of record; if something needed isn't
covered, stop and raise it rather than inventing behavior.

---

## 1. Conventions

- **FR-xxx**: Functional Requirement
- **BR-xxx**: Business Rule (module-local; global rules are in Volume 01 §7)
- **VR-xxx**: Validation Rule
- **EV-xxx**: Event emitted
- **AC**: Acceptance Criteria for the preceding FR

---

## 2. Module: Identity Platform

### 2.1 Purpose
Own authentication, authorization, sessions, and account security for every
actor on the platform (shopper, vendor, vendor staff, admin).

### 2.2 Functional Requirements

**FR-ID-001 — Email/password signup**
A user can register with email + password. Password strength enforced
(min 10 chars, not in common-password list). Email verification required
before full account access.
- AC: Unverified accounts can log in but are restricted from checkout,
  reviews, and vendor actions until email is verified.
- AC: Duplicate email registration returns a generic "check your email"
  response (does not leak whether the email already exists).

**FR-ID-002 — OTP login/verification**
Support OTP via email (SMS deferred — no SMS provider selected yet) for
login and for email verification.
- VR: OTP is 6 digits, expires in 10 minutes, max 5 attempts before
  lockout with backoff.

**FR-ID-003 — OAuth login**
Support Google OAuth as a login method, linked to the same user record as
email/password if emails match and the email is verified by the provider.

**FR-ID-004 — MFA**
Users can enable TOTP-based MFA. Required (not optional) for vendor-owner
and admin roles before they can perform state-changing actions.
- AC: An admin/vendor-owner account without MFA enabled is blocked from
  admin/vendor actions with a clear prompt to enable it, not a silent
  failure.

**FR-ID-005 — Sessions & devices**
Track active sessions per user (device, IP, last active). Users can view
and revoke sessions. Refresh tokens are rotated on use; a reused/revoked
refresh token invalidates the whole session family (theft detection).

**FR-ID-006 — RBAC**
Roles: `shopper`, `vendor_owner`, `vendor_staff`, `admin`, `super_admin`.
Permissions are role-based with per-vendor scoping for `vendor_owner` /
`vendor_staff` (a vendor staff member's permissions apply only to their
vendor's resources).
- AC: A vendor_staff token for Vendor A cannot read or mutate Vendor B's
  resources, verified by integration test.

**FR-ID-007 — Audit logs**
Every login, logout, permission change, MFA change, and session revocation
is written to the audit log (EV-ID-*, see §2.4) with actor, action,
target, timestamp, IP.

### 2.3 Business Rules

- BR-ID-01: A user has exactly one identity record; OAuth and
  password/OTP are linked login methods on that one record, not separate
  accounts.
- BR-ID-02: Session tokens are never returned in logs or error messages.
- BR-ID-03: Lockout after 10 failed password attempts within 15 minutes,
  with exponential backoff, independent of OTP lockout (FR-ID-002).

### 2.4 Events

- `EV-ID-001 user.registered`
- `EV-ID-002 user.email_verified`
- `EV-ID-003 user.login_succeeded` / `EV-ID-004 user.login_failed`
- `EV-ID-005 user.mfa_enabled` / `disabled`
- `EV-ID-006 user.session_revoked`

### 2.5 Non-Functional Requirements
- Password hashing: argon2id.
- Auth endpoints: rate limited (5 req/min/IP for login, 3 req/min for OTP
  request).
- Token expiry: access token 15 min, refresh token 30 days (rotated).

---

## 3. Module: User Platform

### 3.1 Purpose
Own the shopper-facing profile: personal info, addresses, wishlist, order
history, preferences, notification/privacy settings.

### 3.2 Functional Requirements

**FR-USR-001 — Profile management**
User can view/edit name, phone, avatar, date of birth (optional).
- VR: Phone number validated against E.164 format; verified via OTP
  (reuses FR-ID-002 flow) before it's usable for order contact.

**FR-USR-002 — Addresses**
User can add/edit/delete multiple addresses, mark one default per type
(billing/shipping).
- AC: Deleting an address referenced by a past order soft-deletes it
  (order history still shows the address as it was at order time).

**FR-USR-003 — Wishlist**
User can add/remove products to a wishlist; wishlist is private by
default.

**FR-USR-004 — Order & booking history**
User can view all past orders (Product Marketplace) with status.
Booking history is a placeholder (empty state) until Services Marketplace
ships.

**FR-USR-005 — Preferences & notification settings**
User controls channel preferences (email/push — SMS/WhatsApp deferred)
per notification category (order updates, marketing, community — even
though marketing/community aren't built yet, the preference model is
built now so it doesn't require a schema change later).
- BR-USR-01: Marketing-category consent defaults to **off**; transactional
  categories (order/account) cannot be disabled.

**FR-USR-006 — Privacy settings**
User can request account data export and account deletion (soft delete +
scheduled hard delete per data retention policy, defined in Volume 13).

### 3.3 Events
- `EV-USR-001 user.profile_updated`
- `EV-USR-002 user.address_added` / `removed`
- `EV-USR-003 user.deletion_requested`

---

## 4. Module: Vendor Platform

### 4.1 Purpose
Everything a vendor needs to register, get verified, and run their
storefront: products, inventory, staff, commissions, documents, basic
analytics.

### 4.2 Functional Requirements

**FR-VND-001 — Vendor registration**
A user applies to become a vendor: business name, business type, contact,
address, bank/payout details, and required documents (business
registration, organic certification if applicable).
- AC: Registration is not usable as a storefront until BR-VND-01
  (verification) passes.

**FR-VND-002 — Vendor verification (admin)**
Admin reviews submitted documents and either approves, rejects (with
reason), or requests more info.
- AC: Rejection with reason notifies the applicant and allows resubmission.
- AC: Approval emits `EV-VND-002` and unlocks storefront + product
  creation.

**FR-VND-003 — Store management**
Vendor owner configures store name, description, logo/banner, policies
(returns, shipping), and business hours (for future service use).

**FR-VND-004 — Employees / vendor staff**
Vendor owner can invite staff with scoped roles (`vendor_staff`) and
permissions (manage products, view orders, fulfill orders — no payout
access for staff by default).

**FR-VND-005 — Product & inventory management**
Vendor creates/edits products (see Product Marketplace module for the
product model itself) and manages stock levels, low-stock alerts.

**FR-VND-006 — Commissions & wallet**
Platform commission is computed per completed, non-refunded order line
per the vendor's commission rate (category-based default, override per
vendor if negotiated). Vendor wallet accrues net-of-commission amounts;
payout schedule and mechanism defined in Volume 07/09.
- BR-VND-01: Commission rate changes apply only to orders placed after the
  change (no retroactive recalculation).

**FR-VND-007 — Vendor analytics (basic)**
Vendor dashboard shows sales, order volume, top products, over
selectable date ranges. Advanced analytics (forecasting, cohort) deferred
to Volume 10's Analytics Platform.

**FR-VND-008 — Documents & certificates**
Vendor uploads and manages business/organic certification documents;
expiring certifications trigger a reminder notification.

### 4.3 Business Rules
- BR-VND-01: See FR-VND-006.
- BR-VND-02: A vendor cannot list a product with an "organic" claim
  without an approved certification document on file for that claim
  (ties to BRS §7 rule 3).
- BR-VND-03: A vendor whose verification is revoked has all active
  listings immediately delisted (not deleted) and existing orders are
  unaffected/still fulfilled.

### 4.4 Events
- `EV-VND-001 vendor.registered`
- `EV-VND-002 vendor.verified` / `EV-VND-003 vendor.rejected`
- `EV-VND-004 vendor.revoked`
- `EV-VND-005 vendor.staff_invited`
- `EV-VND-006 vendor.certificate_expiring`

---

## 5. Module: Product Marketplace

### 5.1 Purpose
Catalog, discovery, and purchase-decision support for organic/eco
products.

### 5.2 Functional Requirements

**FR-PRD-001 — Categories & brands**
Hierarchical categories (max depth 3 for foundation phase); brands are a
flat, admin-moderated list vendors can request additions to.

**FR-PRD-002 — Product & variants**
A product has attributes (organic claim, unit, origin, etc.) and
variants (e.g., size/weight) each with their own SKU, price, and stock.
- VR: Every SKU is unique platform-wide.
- BR-PRD-01: A product's "organic" attribute can only be set to true if
  BR-VND-02 is satisfied for the owning vendor.

**FR-PRD-003 — Pricing, offers, coupons**
Products have a base price; time-bound offers (% or flat discount) and
platform/vendor coupons can apply. Coupon stacking rules are explicit
(default: one platform coupon + one vendor coupon max per order).

**FR-PRD-004 — Reviews & questions**
Buyers can review a product only if BR (Volume 01 §7 rule 4) is satisfied
— i.e., they have a completed order containing that product/SKU.
Q&A is open to any authenticated user; vendor can answer.

**FR-PRD-005 — Search & filtering**
Full-text + faceted search (category, brand, price range, organic
certified, rating, availability) backed by OpenSearch, kept in sync with
Postgres via domain events (`product.updated` → reindex job).

**FR-PRD-006 — Recommendations (rules-based)**
"Frequently bought together" (co-purchase frequency) and "similar
products" (same category/attributes) for foundation phase. AI-driven
personalized recommendations are Volume 10 scope.

**FR-PRD-007 — Wishlist & compare**
Compare up to 4 products side-by-side on shared attributes. (Wishlist
itself is owned by User Platform, FR-USR-003; this FR covers the
product-side compare UI/data needs.)

### 5.3 Events
- `EV-PRD-001 product.created` / `updated` / `delisted`
- `EV-PRD-002 review.submitted`
- `EV-PRD-003 product.stock_low`

---

## 6. Module: Orders

### 6.1 Purpose
Cart through fulfillment for physical products.

### 6.2 Functional Requirements

**FR-ORD-001 — Cart**
Persistent cart per user (survives session), merges guest cart on login.
Cart validates stock and price at checkout time, not just at add-time.

**FR-ORD-002 — Checkout**
Multi-step: address selection → shipping method → payment (Razorpay) →
review → place order. Order is only created after payment authorization
succeeds (no "pending payment forever" orders left visible as active).

**FR-ORD-003 — Payments**
Razorpay integration for card/UPI/netbanking. Webhook-driven payment
status updates (not just client-side confirmation) are the source of
truth for order payment state.
- BR-ORD-01: An order's `paid` status is only set from a verified Razorpay
  webhook signature, never from client callback alone.

**FR-ORD-004 — Invoices**
System-generated invoice (PDF) per order, GST-compliant line items.

**FR-ORD-005 — Returns, refunds, exchanges**
Buyer requests return within policy window (per category); vendor/admin
approves; refund issued via Razorpay refund API; state machine tracked
(requested → approved/rejected → refunded).

**FR-ORD-006 — Shipping & tracking**
Order has shipment record with carrier + tracking number (manually
entered by vendor in foundation phase; carrier API integration deferred).

**FR-ORD-007 — Taxes**
GST computed per line item based on category tax rate and shipping
address state (India-specific CGST/SGST/IGST logic).

### 6.3 Events
- `EV-ORD-001 order.placed`
- `EV-ORD-002 order.paid` (from verified webhook only)
- `EV-ORD-003 order.shipped` / `delivered`
- `EV-ORD-004 order.return_requested` / `refunded`

---

## 7. Cross-Cutting Non-Functional Requirements

- All list endpoints paginated (cursor-based for catalog/search, offset
  for admin tables).
- All monetary values stored as integer minor units (paise), never float.
- All timestamps stored UTC, rendered in user locale on the frontend.
- P95 latency targets per Volume 01 §8.
- Every FR above ships with unit tests for its domain rules and at least
  one integration test for its primary API flow, per Volume 00 §10.

## 8. Traceability

Each FR maps to Volume 01 §7 business rules and/or §3 business goals.
Full traceability matrix (FR ↔ BR ↔ test id) is maintained in Volume 14
(Testing) once implementation begins — not duplicated here to avoid two
sources of truth drifting apart.
