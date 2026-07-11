import type { VendorDocument } from '../entities/vendor-document.entity';

/**
 * Domain-owned repository interface (port). Infrastructure layer provides
 * the Prisma-backed implementation (Architecture Volume 03 §4). No Prisma
 * types appear here. Mirrors VendorRepository's shape.
 */
export interface VendorDocumentRepository {
  findById(id: string): Promise<VendorDocument | null>;
  findByVendorId(vendorId: string): Promise<VendorDocument[]>;
  save(document: VendorDocument): Promise<void>;
}

export const VENDOR_DOCUMENT_REPOSITORY = Symbol('VENDOR_DOCUMENT_REPOSITORY');
