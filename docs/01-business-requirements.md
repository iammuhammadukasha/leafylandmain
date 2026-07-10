# Volume 01 — Business Requirements Specification (BRS)

Status: Draft v0.1
Scope: Foundation phase — Identity, User, Vendor, Product Marketplace

---

## 1. Executive Summary

LeafyLand is a marketplace and services platform exclusively for organic
products and eco-friendly services. The foundation phase delivers a
production-grade core: account identity, user profiles, vendor onboarding
and storefronts, and a product marketplace with search, cart, and checkout.
Later phases add services booking, community, CMS, marketing automation,
and AI features on top of this core without architectural rework.

## 2. Vision & Mission

See Volume 00 §1–2. Restated for business audience: LeafyLand exists so
that a shopper can trust that everything on the platform is genuinely
sustainable, and so that a small organic farm or eco-vendor has the same
quality of storefront, discovery, and payment tools as a major retailer.

## 3. Business Goals

1. Launch a trustworthy organic marketplace MVP with verified vendors and
   verified organic claims.
2. Achieve vendor self-service onboarding (registration → verification →
   first listing) without manual engineering intervention.
3. Support checkout end-to-end (cart → payment → invoice → fulfillment
   tracking) for physical products.
4. Establish the platform's data model and module boundaries so that
   Services, Community, CMS, Marketing, and AI can be added additively.
5. Meet the security, audit, and compliance bar required to handle
   payments and personal data from day one.

## 4. Stakeholders

| Stakeholder | Interest |
|---|---|
| Shoppers | Trustworthy organic products, easy discovery, fair pricing, reliable delivery |
| Vendors | Low-friction onboarding, visibility, fair commission, sales tools |
| Platform Admins | Vendor verification, content moderation, dispute resolution, oversight |
| LeafyLand business owner | Growth, trust/brand integrity, revenue via commission |
| Engineering (incl. AI coding agents) | Unambiguous, testable requirements to implement against |
| Future stakeholders (deferred phases) | Service providers, community members, marketing team |

## 5. Business Scope

### In scope — Foundation phase

- Identity: signup, login, OTP, OAuth, MFA, sessions/devices, RBAC
- User profile, addresses, wishlist, order history, preferences
- Vendor registration, verification, storefront, product listings,
  inventory, basic vendor analytics
- Product marketplace: categories, brands, attributes/variants, pricing,
  offers/coupons, reviews, search/filtering, recommendations (rules-based
  to start; AI recommendations deferred to Volume 10)
- Orders: cart, checkout, payments, invoices, returns/refunds, shipping,
  tracking, taxes
- Platform admin basics: user management, vendor approval, order/content
  oversight, audit logs

### Out of scope — Foundation phase (deferred to later volumes/phases)

- Services Marketplace (bookings, providers, scheduling)
- Community Platform (posts, groups, messaging)
- CMS (blogs, recipes, knowledge base)
- Marketing Automation (campaigns, CRM, funnels)
- AI Platform beyond basic rules-based recommendations
- Sustainability Platform extras (carbon footprint, tree plantation,
  impact dashboard) beyond organic certification verification needed for
  product trust

## 6. Platform Modules (Full Ecosystem Map)

Retained for context; foundation phase implements the bolded modules only.

- **Identity Platform**
- **User Platform**
- **Vendor Platform**
- **Product Marketplace**
- Services Marketplace
- **Orders**
- Community Platform
- CMS
- Marketing Automation
- AI Platform
- Sustainability Platform (certification verification only, foundation phase)
- Analytics Platform (basic vendor/admin reporting only, foundation phase)
- **Admin Platform** (basic: user/vendor/order oversight, audit logs)

## 7. Business Rules

1. Only eco-friendly, organic, or sustainability-aligned products and
   services may be listed on the platform.
2. Every vendor must complete identity and business verification before
   their storefront goes live.
3. Products with an organic claim must have that claim backed by an
   uploaded certification, which is reviewed before the listing is
   approved for sale.
4. Only buyers with a verified, completed order for a product may leave a
   review for it.
5. Only buyers with a completed booking may leave a review for a service
   (rule retained for when Services Marketplace ships; not active in
   foundation phase).
6. Every business-significant action (orders, payments, refunds, vendor
   approvals, admin overrides) must be recorded in an immutable audit log.
7. Every significant domain event (order placed, payment captured, vendor
   approved, etc.) must emit a system event other modules can subscribe to.
8. Marketing communications must respect user consent and provide opt-out
   (rule retained for Marketing Automation phase; foundation phase collects
   consent state even though campaigns aren't built yet).
9. Commission on vendor sales is calculated per vendor agreement and is
   transparent to the vendor in their dashboard.
10. Refunds and returns follow a documented policy window per product
    category; exceptions require admin approval and are audit-logged.

## 8. Success Metrics (Foundation Phase)

| Metric | Target |
|---|---|
| Vendor self-service onboarding completion rate | ≥ 70% of started registrations reach "pending verification" |
| Time from vendor submission to verification decision | ≤ 48 hours (admin SLA) |
| Checkout completion rate (cart → paid order) | ≥ 60% |
| Order-to-review eligible verification accuracy | 100% (no unverified reviews possible by design) |
| P95 API latency, catalog browse/search | < 300ms |
| P95 API latency, checkout | < 800ms |
| Audit log coverage of state-changing endpoints | 100% |
| Test coverage, domain/application layers | ≥ 80% |

## 9. Decisions & Assumptions

- **Market & currency:** India-first launch. INR only, India-only shipping
  and tax (GST) rules for the foundation phase. Multi-currency/multi-region
  is explicitly out of scope until a later phase.
- **Payment gateway:** Razorpay, consistent with the validated prototype.
  Integrated directly in the Orders module (Volume 03/07); not built as a
  provider-agnostic abstraction for the foundation phase — add that
  abstraction only if/when a second gateway is actually needed.
- Organic certification verification is manual (admin review of uploaded
  documents) in foundation phase; automated verification via third-party
  registries is a future enhancement, not foundation scope.
