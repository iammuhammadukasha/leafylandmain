/**
 * Domain-level error types. These carry no HTTP concerns (no status
 * codes) — the interface layer maps them to AppException with the right
 * HTTP status + error code from the API spec taxonomy. Keeps
 * domain/application free of framework types.
 */

export class VendorAlreadyExistsError extends Error {
  constructor() {
    super('You already have a vendor account.');
    this.name = 'VendorAlreadyExistsError';
  }
}

export class VendorNotFoundError extends Error {
  constructor() {
    super('Vendor not found.');
    this.name = 'VendorNotFoundError';
  }
}

export class VendorForbiddenError extends Error {
  constructor(message = 'You are not authorized to perform this action.') {
    super(message);
    this.name = 'VendorForbiddenError';
  }
}

// FR-VND-008 (minimal vendor_documents slice)

export class VendorDocumentNotFoundError extends Error {
  constructor() {
    super('Vendor document not found.');
    this.name = 'VendorDocumentNotFoundError';
  }
}
