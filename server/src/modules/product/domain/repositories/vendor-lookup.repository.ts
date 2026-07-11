/**
 * Domain-owned port for the narrow vendor facts Product's use cases need
 * (vendor's verification status, ownership). `vendors` is a Vendor-context
 * table (Volume 04 §4), but per the Architecture §3 cross-context rule ("a
 * module never queries another module's database tables directly...
 * Prisma schemas are organized so each module's models are only injected
 * into that module's repositories"), Product gets its OWN thin, read-only
 * repository over that table for the two queries it needs — same pattern
 * as Vendor's own `UserRolesRepository` reading Identity's `user_roles`.
 *
 * DESIGN DECISION: this is a *read* port only, scoped to what Product's
 * publish-gating (FR-VND-005: "requires verified vendor") and ownership
 * checks (FR-VND-005: vendor-scoped product management) require. It does
 * not reach into Vendor's domain entities or use cases.
 */
export interface VendorSummary {
  id: string;
  ownerUserId: string;
  status: 'pending' | 'verified' | 'rejected' | 'revoked';
}

export interface VendorLookupRepository {
  findByOwnerUserId(ownerUserId: string): Promise<VendorSummary | null>;
  findById(id: string): Promise<VendorSummary | null>;
}

export const VENDOR_LOOKUP_REPOSITORY = Symbol('VENDOR_LOOKUP_REPOSITORY');
