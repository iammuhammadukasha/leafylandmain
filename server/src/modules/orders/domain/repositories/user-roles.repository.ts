/**
 * Domain-owned port for RBAC role lookups (FR-ID-006) needed by Orders'
 * returns endpoints (FR-ORD-005 approve/reject: "vendor_owner/vendor_staff
 * of the owning vendor, OR admin"). `user_roles` is an Identity-context
 * table (Volume 04 §2), but per the Architecture §3 cross-context rule ("a
 * module never queries another module's database tables directly"), Orders
 * gets its OWN thin, read-only repository over that table — exact mirror of
 * Vendor's own UserRolesRepository
 * (server/src/modules/vendor/domain/repositories/user-roles.repository.ts),
 * not a reuse of Vendor's port instance (Constitution §6.2: no cross-context
 * imports of another module's repositories).
 *
 * Same DB-lookup-per-request design decision as Vendor's port (not embedded
 * in the JWT) — see that port's doc comment for the full reasoning.
 */
export interface OrdersUserRolesRepository {
  /** True if the user has the `admin` role (global, vendorId null on the
   * row) — the only role this port is used to check in this slice
   * (ApproveReturnUseCase / RejectReturnUseCase's "OR admin" branch). */
  hasAdminRole(userId: string): Promise<boolean>;
}

export const ORDERS_USER_ROLES_REPOSITORY = Symbol(
  'ORDERS_USER_ROLES_REPOSITORY',
);
