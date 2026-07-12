/**
 * Domain-owned port for the narrow vendor facts Orders' vendor-fulfillment
 * use cases need (FR-ORD-006: resolve the caller to "their" vendor id).
 * `vendors` is a Vendor-context table (Volume 04 §4), but per the
 * Architecture §3 cross-context rule ("a module never queries another
 * module's database tables directly... Prisma schemas are organized so
 * each module's models are only injected into that module's
 * repositories"), Orders gets its OWN thin, read-only repository over that
 * table — exact same pattern as Product's own VendorLookupRepository
 * (server/src/modules/product/domain/repositories/vendor-lookup.repository.ts),
 * not a reuse of Vendor's VENDOR_REPOSITORY port (that port returns the
 * full mutable Vendor aggregate, meant for Vendor's own write use cases —
 * Orders only ever needs the id).
 */
export interface OrdersVendorSummary {
  id: string;
  ownerUserId: string;
}

export interface VendorLookupRepository {
  findByOwnerUserId(ownerUserId: string): Promise<OrdersVendorSummary | null>;
}

export const VENDOR_LOOKUP_REPOSITORY = Symbol(
  'ORDERS_VENDOR_LOOKUP_REPOSITORY',
);
