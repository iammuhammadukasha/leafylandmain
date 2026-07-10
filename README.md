# LeafyLand v2

A ground-up rebuild of LeafyLand as a scalable ecosystem for organic
products, eco-friendly services, and sustainable living — see
[docs/00-project-constitution.md](docs/00-project-constitution.md) for
the full vision and engineering standards.

This is a new project, distinct from the earlier prototype
(`leafyland`, React/Vite + NestJS + Supabase, live at leafyland.shop).
LeafyLand v2 uses a different stack (Next.js, NestJS modular monolith,
PostgreSQL/Prisma, Redis, OpenSearch, BullMQ) chosen for long-term control
as the platform grows — see
[docs/03-system-architecture.md](docs/03-system-architecture.md) §1 for
the rationale. No code from the prototype is reused.

## Documentation Suite

Foundation phase (Identity, User, Vendor, Product Marketplace, Orders):

| Volume | Document |
|---|---|
| 00 | [Project Constitution](docs/00-project-constitution.md) |
| 01 | [Business Requirements (BRS)](docs/01-business-requirements.md) |
| 02 | [Software Requirements Specification (SRS) — Core](docs/02-srs-core.md) |
| 03 | [System Architecture](docs/03-system-architecture.md) |
| 04–06 | [Database Architecture & ERDs](docs/04-database-architecture-and-erd.md) |

Volumes 07–16 (API Specs, Frontend/Backend Architecture, AI Platform,
Marketing Automation, Admin Panel, Security, Testing, DevOps, Coding
Agent Manual) and the deferred modules (Services Marketplace, Community,
CMS) are scoped for a second documentation pass once the foundation phase
is implemented — see [docs/00-project-constitution.md](docs/00-project-constitution.md) §13.

## Status

Documentation phase. No application code yet — see the Constitution's
Definition of Done (§12) before any implementation begins.
