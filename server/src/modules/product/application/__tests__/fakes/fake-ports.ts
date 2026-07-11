import type {
  VendorLookupRepository,
  VendorSummary,
} from '../../../domain/repositories/vendor-lookup.repository';
import type {
  VendorDocumentLookupRepository,
  VendorDocumentSummary,
} from '../../../domain/repositories/vendor-document-lookup.repository';
import type {
  OrderLineLookupRepository,
  OrderLineSummary,
} from '../../../domain/repositories/order-line-lookup.repository';
import type {
  AuditEvent,
  AuditLogger,
} from '../../../../identity/application/ports/audit-logger.port';
import type { UserRolesRepository } from '../../../../vendor/domain/repositories/user-roles.repository';

/** In-memory stand-in for Product's cross-context VendorLookupRepository
 * port. Seed with `.seed(summary)` in tests. */
export class FakeVendorLookupRepository implements VendorLookupRepository {
  private readonly vendors: VendorSummary[] = [];

  seed(vendor: VendorSummary): void {
    this.vendors.push(vendor);
  }

  findByOwnerUserId(ownerUserId: string): Promise<VendorSummary | null> {
    return Promise.resolve(
      this.vendors.find((v) => v.ownerUserId === ownerUserId) ?? null,
    );
  }

  findById(id: string): Promise<VendorSummary | null> {
    return Promise.resolve(this.vendors.find((v) => v.id === id) ?? null);
  }
}

/** In-memory stand-in for Product's cross-context
 * VendorDocumentLookupRepository port. */
export class FakeVendorDocumentLookupRepository implements VendorDocumentLookupRepository {
  private readonly documents: VendorDocumentSummary[] = [];

  seed(document: VendorDocumentSummary): void {
    this.documents.push(document);
  }

  findById(id: string): Promise<VendorDocumentSummary | null> {
    return Promise.resolve(this.documents.find((d) => d.id === id) ?? null);
  }
}

/** Reused shape of Vendor's FakeUserRolesRepository (application layer
 * cannot import Vendor's __tests__ folder across module test boundaries
 * cleanly via relative path in a maintainable way, so this is a local,
 * intentionally duplicated minimal copy — same precedent as Vendor's own
 * fakes being local to its module). */
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

/** In-memory stand-in for Product's cross-context
 * OrderLineLookupRepository port. Seed with `.seed(summary)` in tests —
 * mirrors FakeVendorLookupRepository's shape. */
export class FakeOrderLineLookupRepository implements OrderLineLookupRepository {
  private readonly lines: OrderLineSummary[] = [];

  seed(line: OrderLineSummary): void {
    this.lines.push(line);
  }

  findById(id: string): Promise<OrderLineSummary | null> {
    return Promise.resolve(this.lines.find((l) => l.id === id) ?? null);
  }
}

export class FakeAuditLogger implements AuditLogger {
  public readonly events: AuditEvent[] = [];

  record(event: AuditEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}
