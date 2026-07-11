import type { VendorDocument } from '../../../domain/entities/vendor-document.entity';
import type { VendorDocumentRepository } from '../../../domain/repositories/vendor-document.repository';

export class InMemoryVendorDocumentRepository implements VendorDocumentRepository {
  private readonly documentsById = new Map<string, VendorDocument>();

  findById(id: string): Promise<VendorDocument | null> {
    return Promise.resolve(this.documentsById.get(id) ?? null);
  }

  findByVendorId(vendorId: string): Promise<VendorDocument[]> {
    return Promise.resolve(
      [...this.documentsById.values()].filter(
        (document) => document.vendorId === vendorId,
      ),
    );
  }

  save(document: VendorDocument): Promise<void> {
    this.documentsById.set(document.id, document);
    return Promise.resolve();
  }

  get all(): VendorDocument[] {
    return [...this.documentsById.values()];
  }
}
