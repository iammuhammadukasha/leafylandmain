/**
 * Domain-owned port for writing the `vendor_owner` role grant that must
 * accompany vendor registration (FR-VND-001: "Should also create a
 * user_roles row granting vendor_owner scoped to that new vendor"). Kept
 * separate from `UserRolesRepository` (read-only role-check port) because
 * this is a write with a narrower purpose — granting exactly one role at
 * registration time — not a general-purpose role-mutation API, per
 * Constitution §11.6 (no speculative abstraction beyond what this slice
 * needs).
 */
export interface VendorRoleGrantRepository {
  grantVendorOwner(userId: string, vendorId: string): Promise<void>;
}

export const VENDOR_ROLE_GRANT_REPOSITORY = Symbol(
  'VENDOR_ROLE_GRANT_REPOSITORY',
);
