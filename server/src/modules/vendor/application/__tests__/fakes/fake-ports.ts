import type { VendorRoleGrantRepository } from '../../../domain/repositories/vendor-role-grant.repository';
import type { UserRolesRepository } from '../../../domain/repositories/user-roles.repository';
import type {
  AuditEvent,
  AuditLogger,
} from '../../../../identity/application/ports/audit-logger.port';

export class FakeVendorRoleGrantRepository implements VendorRoleGrantRepository {
  public readonly grants: Array<{ userId: string; vendorId: string }> = [];

  grantVendorOwner(userId: string, vendorId: string): Promise<void> {
    this.grants.push({ userId, vendorId });
    return Promise.resolve();
  }
}

/** In-memory stand-in for the (userId, roleName, vendorId?) -> boolean role
 * check. Seed with `.grant(userId, roleName, vendorId?)` in tests. */
export class FakeUserRolesRepository implements UserRolesRepository {
  private readonly rows: Array<{
    userId: string;
    roleName: string;
    vendorId: string | null;
  }> = [];

  grant(userId: string, roleName: string, vendorId?: string): void {
    this.rows.push({ userId, roleName, vendorId: vendorId ?? null });
  }

  hasRole(
    userId: string,
    roleName: string,
    vendorId?: string,
  ): Promise<boolean> {
    const match = this.rows.some(
      (row) =>
        row.userId === userId &&
        row.roleName === roleName &&
        (row.vendorId === null || row.vendorId === vendorId),
    );
    return Promise.resolve(match);
  }
}

export class FakeAuditLogger implements AuditLogger {
  public readonly events: AuditEvent[] = [];

  record(event: AuditEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}
