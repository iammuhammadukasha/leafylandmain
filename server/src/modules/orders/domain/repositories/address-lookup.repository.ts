/**
 * Domain-owned read port over the `addresses` table (User context, Volume
 * 04 §3). Same cross-context pattern as ProductLookupRepository above.
 *
 * GAP NOTE (per task instruction: "check first before assuming"): the
 * `Address` Prisma model already exists in schema.prisma (User context),
 * but as of this slice `server/src/modules/user/` has NO domain entity,
 * repository, use case, or controller for addresses at all — only a
 * read-only profile slice is built there. So there is no existing
 * "AddressRepository port" anywhere to reuse or import. Rather than
 * blocking checkout on building out the full User-Platform address
 * CRUD surface (FR-USR-002, a different module's scope, and real scope
 * creep for this slice), Orders builds its own minimal read-only lookup
 * over the existing `addresses` table — enough to validate
 * "does this address exist and belong to the calling user" for
 * FR-ORD-002's checkout body. Creating/editing addresses remains
 * out of scope here (deferred to whenever FR-USR-002 is implemented);
 * this slice assumes addresses already exist in the DB (seeded directly
 * for verification, same as any other pre-req fixture).
 */
export interface AddressSummary {
  id: string;
  userId: string;
}

export interface AddressLookupRepository {
  findById(id: string): Promise<AddressSummary | null>;
}

export const ADDRESS_LOOKUP_REPOSITORY = Symbol('ADDRESS_LOOKUP_REPOSITORY');
