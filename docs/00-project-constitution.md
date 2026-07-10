# Volume 00 — Project Constitution

Status: Draft v0.1
Owner: Chief Architect
Applies to: All LeafyLand engineering work, human or AI-assisted

---

## 1. Vision

LeafyLand is the world's most trusted digital ecosystem for organic products,
eco-friendly services, and sustainable living — combining marketplace,
services, community, content, and AI into one platform that can grow from an
MVP to millions of users without a rewrite.

## 2. Mission

Make it effortless to discover, buy, and trust sustainable products and
services, while giving vendors and service providers the tools to run their
business and giving the community a place to learn and connect around
sustainability.

## 3. Relationship to the Prior Prototype

An earlier prototype (`leafyland`, React/Vite + NestJS + Supabase, live at
leafyland.shop) validated demand and core marketplace flows. LeafyLand v2 is
a ground-up rebuild on the stack and architecture defined in this
constitution. It is not a migration; it is a new system informed by lessons
from the prototype. Nothing in this suite assumes prototype code is reused.

## 4. Engineering Principles

1. **Modular monolith first.** One deployable backend, organized into
   strictly bounded modules by domain. Extract a module to its own service
   only when a concrete scaling or ownership need forces it — not
   speculatively.
2. **Domain-Driven Design.** Each bounded context (see Volume 03) owns its
   data, its business rules, and its language. Contexts talk through defined
   interfaces or events, never by reaching into each other's tables.
3. **Clean Architecture / SOLID.** Business logic has no framework or ORM
   dependency. Controllers, persistence, and external integrations are
   adapters around a framework-agnostic domain + application core.
4. **API-first.** Every capability is designed as an API contract
   (OpenAPI) before implementation. Frontend and backend teams (human or AI)
   can work from the contract in parallel.
5. **Event-driven where it earns its keep.** Cross-context side effects
   (e.g., order placed → loyalty points, vendor notified, analytics updated)
   go through domain events on a queue, not synchronous cross-module calls.
6. **CQRS only where reads and writes genuinely diverge** (e.g., analytics,
   search indexing). Default to a single model; don't split reads/writes
   because it looks more "enterprise."
7. **No duplicated business logic.** A rule lives in exactly one place
   (its owning module's domain layer) and is called, never copy-pasted.
8. **No hardcoded values.** Config, limits, feature flags, and business
   thresholds live in configuration/DB, not literals in code.
9. **Strict TypeScript everywhere.** `strict: true`, no `any` without a
   documented reason, no implicit fallthrough.
10. **Security and auditability are not features, they are defaults.** Every
    state-changing action is authenticated, authorized, validated, rate
    limited, and logged before it is fast or convenient.

## 5. Technology Stack (Binding)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand | App Router, SSR/ISR where it helps SEO (product/content pages) |
| Backend | NestJS, TypeScript | Modular monolith; module boundaries = bounded contexts |
| Database | PostgreSQL | Single primary DB; schema-per-module boundaries logically, not physically, unless a module is extracted |
| ORM | Prisma | One schema per deployable; migrations are the only way schema changes |
| Cache | Redis | Session cache, rate limiting, hot-read caching, BullMQ backing store |
| Search | OpenSearch | Product/service/content search and filtering |
| Queues | BullMQ (on Redis) | Domain events, async jobs (email, AI generation, indexing) |
| Storage | S3-compatible object storage | Product images, documents, certificates, media library |
| Auth | JWT (access/refresh) + OAuth + OTP + MFA | Custom Identity Platform module (Volume 03), not a third-party auth-as-a-service |
| Infra | Docker, GitHub Actions, Nginx, Prometheus, Grafana; Kubernetes future | Docker Compose for local/staging; K8s only when scale requires it |

Deviations from this table require a written architecture decision record
(ADR) with the reason. This stack is chosen explicitly over the prototype's
Supabase-based stack to give LeafyLand full control over auth, data, and
infrastructure as it scales — see Volume 03 §1 for the tradeoffs considered.

## 6. Coding Standards

- Language: TypeScript everywhere (frontend, backend, scripts).
- Formatting/linting enforced in CI (Prettier + ESLint); no unformatted
  code merges.
- Naming: domain language from the Ubiquitous Language glossary (Volume 03),
  not generic CRUD nouns.
- Every module: `domain/`, `application/`, `infrastructure/`,
  `interface/` (controllers/resolvers) separation.
- No business logic in controllers, DTOs, or Prisma models.
- Public module APIs are explicit (NestJS module exports); nothing is
  reached into via deep imports across module boundaries.

## 7. Database Standards

Every table includes:

- `id` — UUID, primary key
- `created_at`, `updated_at` — timestamptz, managed by ORM
- `deleted_at` — nullable timestamptz, for soft delete where the entity has
  a lifecycle worth preserving (orders, reviews, vendors, content). Pure
  lookup/junction tables may omit this — document the exception in the ERD.
- `created_by`, `updated_by` — nullable FK to users, for auditability
- `version` — integer, optimistic concurrency on entities with concurrent
  edit risk (inventory, wallet balances, booking slots)

All foreign keys are indexed. All schema changes are migrations, generated
and reviewed, never applied by hand against an environment.

## 8. API Standards

Every endpoint includes:

- Input validation (class-validator DTOs)
- Authentication (JWT) unless explicitly public
- Authorization (RBAC/policy check)
- Rate limiting (per-user and per-IP tiers)
- Structured logging (request id, user id, module, outcome)
- Versioning (`/api/v1/...`)
- OpenAPI documentation (generated from decorators, not hand-maintained)
- Standard response envelope and error code taxonomy (defined in Volume 07)
- Pagination for all list endpoints (cursor-based for feeds, offset for
  admin tables)

## 9. Security Standards

OWASP Top 10 mitigations are mandatory, not aspirational:

- RBAC enforced at the API layer for every mutating and sensitive-read
  endpoint
- MFA available for all accounts, required for vendor/admin roles
- Passwords hashed with argon2id; secrets never logged
- Audit log for every business-significant state change (Volume 03 §7)
- Encryption at rest for sensitive fields (PII, payment references)
- Input validation at every boundary; parameterized queries only (Prisma
  default) — no raw SQL string interpolation
- CSRF protection on cookie-based flows; XSS mitigated via output encoding
  and CSP headers
- Rate limiting on auth, search, and write-heavy endpoints
- File uploads: type/size validation, virus scan hook, private-by-default
  storage with signed URLs

## 10. Testing Standards

- Unit tests for all domain/application logic
- Integration tests for module APIs against a real Postgres (test
  container), not mocks, for anything touching persistence or transactions
- Critical end-to-end tests for the golden paths: signup→purchase,
  vendor onboarding→first sale, booking→completion→review
- Performance tests for search, catalog listing, and checkout under load
  before each major release
- Target coverage: 80%+ on domain/application layers; coverage on
  controllers/infrastructure is a byproduct, not a target to game

## 11. AI Coding Rules

When AI agents (Claude Code or similar) implement LeafyLand features:

1. Work from the SRS and API spec for the feature — do not invent
   requirements or endpoints not documented.
2. Respect module boundaries; do not import across bounded contexts.
3. Do not hand-roll auth, payments, or crypto — use the Identity Platform
   and defined integrations.
4. Every new endpoint ships with its OpenAPI annotation and tests in the
   same change.
5. If a requirement is ambiguous, stop and ask rather than assuming — file
   an open question in the SRS rather than guessing silently in code.
6. No speculative abstraction: build the module for the bounded context in
   front of you, not a generic framework for all future modules.

## 12. Definition of Done

A feature is done when:

- [ ] Matches an approved SRS entry (acceptance criteria met)
- [ ] API documented in OpenAPI, versioned
- [ ] Validation, auth, authorization, rate limiting, logging in place
- [ ] Unit + integration tests passing, coverage target met
- [ ] Migration reviewed and applied via CI, not by hand
- [ ] Audit events emitted for state changes
- [ ] Security checklist reviewed (OWASP-relevant items for this feature)
- [ ] Reviewed against this constitution for architectural fit

## 13. Document Suite Map

| Vol | Title | Status |
|---|---|---|
| 00 | Project Constitution | Draft (this document) |
| 01 | Business Requirements (BRS) | Draft |
| 02 | Software Requirements Specification (SRS) — Core | Draft |
| 03 | System Architecture | Draft |
| 04 | Database Architecture | Draft |
| 05 | ERDs | Draft |
| 06 | (merged into 04/05 for foundation phase) | — |
| 07 | API Specifications | Not started |
| 08 | Frontend Architecture | Not started |
| 09 | Backend Architecture | Not started |
| 10 | AI Platform | Not started |
| 11 | Marketing Automation | Not started |
| 12 | Admin Panel | Not started |
| 13 | Security | Not started (baseline in this doc, §9) |
| 14 | Testing | Not started (baseline in this doc, §10) |
| 15 | DevOps & Deployment | Not started |
| 16 | Coding Agent Manual | Not started |

Foundation phase (this pass) covers Volumes 00–05, scoped to the core
platform: Identity, User, Vendor, and Product Marketplace. Services
Marketplace, Community, CMS, Marketing Automation, AI Platform, and Admin
are deferred to a second documentation pass once the core is implemented
and validated.
