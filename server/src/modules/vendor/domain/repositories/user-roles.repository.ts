/**
 * Domain-owned port for RBAC role lookups (FR-ID-006) needed by Vendor
 * endpoints. `user_roles` is an Identity-context table (Volume 04 §2), but
 * per the Architecture §3 cross-context rule ("a module never queries
 * another module's database tables directly... Prisma schemas are
 * organized so each module's models are only injected into that module's
 * repositories"), Vendor gets its OWN thin, read-only repository over that
 * same table for the one query it needs (role membership) rather than
 * reaching into Identity's internals or importing an Identity repository
 * that doesn't exist for this purpose. This mirrors how User context reads
 * Identity's `USER_REPOSITORY` port for existence checks — a public,
 * narrow, purpose-built interface — except here it's Vendor-local because
 * Identity does not (yet) export a roles port of its own (see
 * vendor.module.ts and the final report for the full reasoning).
 *
 * DESIGN DECISION: role checks are done via a DB lookup per request, not
 * embedded in the JWT (`AccessTokenClaims.roles` stays `[]`, unchanged).
 * Roles are per-vendor-scoped and change rarely relative to request
 * volume, so a lookup is cheap and avoids stale-role bugs that a 15-minute
 * cached JWT claim would introduce (e.g., a just-revoked admin still
 * passing role checks for up to 15 minutes). See final report for full
 * reasoning.
 */
export interface UserRolesRepository {
  /** True if the user has `roleName` globally (vendorId null on the row)
   * OR scoped to the given `vendorId` when provided. */
  hasRole(
    userId: string,
    roleName: string,
    vendorId?: string,
  ): Promise<boolean>;
}

export const USER_ROLES_REPOSITORY = Symbol('USER_ROLES_REPOSITORY');
