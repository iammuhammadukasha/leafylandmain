/**
 * Domain-owned port for the narrow vendor_documents facts Product's
 * RegisterProductUseCase needs to enforce BR-PRD-01/BR-VND-02 (organic
 * claim requires an approved organic_certificate document belonging to the
 * caller's vendor). Same cross-context pattern as VendorLookupRepository —
 * see that file's doc comment for the full reasoning.
 */
export interface VendorDocumentSummary {
  id: string;
  vendorId: string;
  type: 'business_registration' | 'organic_certificate' | 'other';
  reviewStatus: 'pending' | 'approved' | 'rejected';
}

export interface VendorDocumentLookupRepository {
  findById(id: string): Promise<VendorDocumentSummary | null>;
}

export const VENDOR_DOCUMENT_LOOKUP_REPOSITORY = Symbol(
  'VENDOR_DOCUMENT_LOOKUP_REPOSITORY',
);
