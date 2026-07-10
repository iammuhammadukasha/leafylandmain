# Volume 03 — System Architecture

Status: Draft v0.1
Scope: Foundation phase (Identity, User, Vendor, Product Marketplace, Orders)

---

## 1. Architecture Style & Rationale

LeafyLand v2 is a **modular monolith**: one NestJS backend deployable,
internally organized into bounded contexts that mirror Volume 01's module
map. This is deliberately chosen over microservices for the foundation
phase:

- The team (human + AI agents) can move faster with one deployable, one CI
  pipeline, one migration history, and transactional consistency across
  modules that are still evolving together (e.g., Orders touching
  Inventory and Vendor Wallet in one transaction).
- Microservices add operational cost (service discovery, distributed
  tracing, network failure modes, data consistency across services) that
  isn't justified until a specific module has a scaling or team-ownership
  need the monolith can't meet.
- Module boundaries are enforced in code now (NestJS module
  imports/exports, no cross-module repository access) precisely so that
  extraction later — if ever needed — is a matter of moving a module's
  code and giving it its own DB/queue, not an untangling project.

This supersedes the prototype's Supabase-based architecture (Supabase
Auth + Supabase Postgres + Supabase Storage, thin NestJS API layer). That
stack optimized for speed-to-prototype; LeafyLand v2 optimizes for
long-term control over auth, data model, and infra as the platform scales
toward the full module map in Volume 01 §6, most of which (Community,
Marketing Automation, AI Platform) needs deep backend logic that doesn't
fit a BaaS model well.

## 2. System Context

```
                         ┌─────────────────────┐
                         │      Shoppers /      │
                         │  Vendors / Admins     │
                         └──────────┬───────────┘
                                    │ HTTPS
                         ┌──────────▼───────────┐
                         │   Next.js Frontend    │
                         │ (storefront, vendor    │
                         │  dashboard, admin)     │
                         └──────────┬───────────┘
                                    │ REST/JSON (OpenAPI), JWT
                         ┌──────────▼───────────┐
                         │     Nginx (reverse    │
                         │   proxy / TLS term)   │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │   NestJS API (modular  │
                         │       monolith)        │
                         └──┬────┬────┬────┬────┘
             ┌──────────────┘    │    │    └──────────────┐
   ┌─────────▼──────┐  ┌─────────▼──┐ │  ┌─────────────────▼───┐
   │  PostgreSQL     │  │   Redis    │ │  │  S3-compatible       │
   │ (system of      │  │ (cache,    │ │  │  storage (images,     │
   │  record)        │  │  sessions, │ │  │  documents, media)    │
   └─────────────────┘  │  BullMQ)   │ │  └───────────────────────┘
                         └────────────┘ │
                              ┌─────────▼──────────┐
                              │   OpenSearch         │
                              │ (catalog/content      │
                              │  search index)        │
                              └───────────────────────┘
                                    │
                         ┌──────────▼───────────┐
                         │   External: Razorpay   │
                         │  (payments/refunds),    │
                         │  Email/OTP provider     │
                         └───────────────────────┘
```

## 3. Bounded Contexts (Foundation Phase)

| Context | Owns | Does not own |
|---|---|---|
| **Identity** | Users (auth identity), credentials, sessions, roles/permissions, MFA, audit log of auth events | User profile details (name/address — that's User context) |
| **User** | Profile, addresses, wishlist, preferences, privacy requests | Auth credentials (Identity), orders themselves (Orders, referenced by id) |
| **Vendor** | Vendor entity, verification state, staff, documents, commission config, wallet ledger | Product catalog data model (Product Marketplace owns products; Vendor owns the *seller*) |
| **Product Marketplace** | Categories, brands, products, variants, pricing, offers/coupons, reviews, search indexing | Cart/checkout/payment (Orders); vendor identity (Vendor) |
| **Orders** | Cart, checkout, payment orchestration, invoices, returns/refunds, shipping/tracking, tax calc | Product data (reads via Product Marketplace's public interface); payout to vendor wallet (emits event, Vendor context reacts) |
| **Admin** (thin, foundation phase) | Cross-module oversight views, vendor approval action delegation, audit log viewer | Business logic itself — Admin invokes application services in other contexts, doesn't reimplement their rules |

Contexts communicate via:
1. **Direct in-process calls to another module's public application
   service** for synchronous needs within the same request (e.g., Orders
   checking Product Marketplace for current price/stock).
2. **Domain events over BullMQ** for cross-context side effects that don't
   need to block the triggering request (e.g., `order.paid` →
   Vendor context credits wallet; `vendor.verified` → notification sent).

Rule: a module never queries another module's database tables directly,
even though they're in the same physical Postgres instance. Prisma
schemas are organized so each module's models are only injected into that
module's repositories.

## 4. Module Internal Layering (Clean Architecture)

Every bounded context module follows the same internal structure:

```
module-name/
  domain/            entities, value objects, domain services, domain events
                      (no NestJS decorators, no Prisma types — pure TS)
  application/        use cases / application services, orchestrate domain
                      + repositories; this is what other modules call
  infrastructure/     Prisma repositories implementing domain repository
                      interfaces, external API clients (Razorpay, S3, etc.)
  interface/           REST controllers, DTOs, OpenAPI decorators — the
                      only layer that knows about HTTP
```

Dependency direction: `interface → application → domain ← infrastructure`.
Domain has zero outward dependencies. This is what keeps business logic
testable without spinning up NestJS or a DB, and keeps a future service
extraction to "move this folder + give it a DB."

## 5. Request Flow Example — Checkout

1. Frontend calls `POST /api/v1/orders/checkout` with cart id, address id,
   payment method (JWT-authenticated).
2. Orders `interface` layer validates DTO, authenticates/authorizes.
3. Orders `application` layer: calls Product Marketplace's application
   service to re-validate price/stock for each cart line (synchronous
   in-process call).
4. Orders creates a pending Order + OrderLines in a DB transaction, calls
   Razorpay to create a payment order, returns payment session info to
   frontend.
5. Frontend completes payment with Razorpay SDK; Razorpay sends a webhook
   to `POST /api/v1/orders/webhooks/razorpay`.
6. Orders verifies webhook signature, marks Order `paid` (BR-ORD-01),
   emits `EV-ORD-002 order.paid` on BullMQ.
7. Async subscribers react: Vendor context credits wallet
   (net-of-commission), notification job emails receipt, analytics job
   updates aggregates, search/inventory job decrements stock.

This flow is the reference pattern for all cross-context writes: the
triggering context owns the transactional write; everything else reacts
to the event, asynchronously, idempotently.

## 6. Frontend Architecture (Summary — detailed in Volume 08)

Next.js App Router, three route groups sharing the design system:
- `(storefront)` — public catalog, cart, checkout, account
- `(vendor)` — vendor dashboard, behind vendor_owner/vendor_staff auth
- `(admin)` — admin console, behind admin/super_admin auth

TanStack Query for server state (API data), Zustand for local UI state
(cart drawer open/closed, filters draft state) — not for server data
caching, to avoid two sources of truth for the same data.

## 7. Cross-Cutting Concerns

### 7.1 Audit Logging
A dedicated `audit_log` table (append-only, no update/delete) records:
actor id, actor role, action, target entity type/id, before/after diff
(where meaningful), IP, timestamp. Written via a shared
`AuditLogger` service injected into application-layer use cases —
business logic calls it explicitly at the point of the state change, it
is not inferred generically from ORM hooks (which would blur *why* an
action happened).

### 7.2 Domain Events
Emitted from application-layer use cases after a successful transaction
commit (not from within the transaction, to avoid acting on events for
work that gets rolled back). BullMQ queue per event category
(`orders`, `vendor`, `identity`, `notifications`) with per-queue
concurrency and retry/backoff policy. Failed jobs after max retries go to
a dead-letter queue reviewed by an admin alert, not silently dropped.

### 7.3 Caching
Redis caches: session/token blocklist, rate-limit counters, hot read paths
(category tree, popular product listings) with short TTL + explicit
invalidation on the relevant domain event (e.g., `product.updated`
invalidates that product's cache key).

### 7.4 Search Indexing
OpenSearch index is a read-optimized projection, never the system of
record. Rebuildable from Postgres at any time. Kept in sync via the
domain event pipeline (`product.created/updated/delisted` →
indexing job), with a scheduled reconciliation job as a safety net against
missed events.

### 7.5 Observability
Structured JSON logs (request id, user id, module, latency, outcome) to
stdout, scraped by the infra logging stack. Prometheus metrics per module
(request rate/latency/error rate, queue depth, job failure rate). Grafana
dashboards per bounded context. Alerts on: auth failure spikes, payment
webhook failures, queue dead-letter growth, P95 latency breach.

## 8. Deployment Topology (Summary — detailed in Volume 15)

- Docker Compose for local dev and staging: `api`, `web`, `postgres`,
  `redis`, `opensearch`, `nginx`.
- GitHub Actions: lint → typecheck → unit tests → integration tests
  (against ephemeral Postgres/Redis containers) → build → deploy.
- Kubernetes is explicitly deferred until a concrete scaling trigger
  (documented in Volume 15) is hit — Compose-on-a-VM plus Nginx is
  sufficient for foundation-phase load.

## 9. Ubiquitous Language (Glossary Seed)

| Term | Meaning |
|---|---|
| Vendor | A verified seller entity (business), distinct from the individual user accounts (owner/staff) that manage it |
| Listing / Product | A sellable item owned by exactly one vendor; has one or more Variants |
| Variant | A specific purchasable SKU of a Product (e.g., 500g vs 1kg) |
| Order | A single checkout's worth of purchased line items, may span multiple vendors |
| Commission | Platform's cut of an order line, computed at order-paid time per BR-VND-01 |
| Verification | The admin-reviewed process that turns a vendor registration into an active, sellable storefront |

This glossary grows as later-phase modules (Services, Community, CMS,
Marketing) are documented — new terms are additive, existing terms are
not redefined without an ADR.

## 10. Open Architecture Decisions (ADR Stubs)

- ADR-001: Payment gateway = Razorpay (resolved, Volume 01 §9).
- ADR-002: SMS/WhatsApp provider — not yet selected; OTP is email-only
  until resolved.
- ADR-003: When/whether to extract Product Marketplace search indexing
  into its own worker service vs. in-process BullMQ processor — revisit
  once real query volume exists.
