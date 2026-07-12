import type {
  ProductLookupRepository,
  ProductVariantSummary,
} from '../../../domain/repositories/product-lookup.repository';
import type {
  AddressLookupRepository,
  AddressSummary,
} from '../../../domain/repositories/address-lookup.repository';
import type {
  OrdersVendorSummary,
  VendorLookupRepository,
} from '../../../domain/repositories/vendor-lookup.repository';
import type { OrdersUserRolesRepository } from '../../../domain/repositories/user-roles.repository';
import type {
  CreateGatewayOrderInput,
  CreateGatewayOrderResult,
  PaymentGatewayPort,
  RefundInput,
  RefundResult,
  WebhookSignatureVerifierPort,
} from '../../ports/payment-gateway.port';
import type {
  AuditEvent,
  AuditLogger,
} from '../../../../identity/application/ports/audit-logger.port';

/** In-memory stand-in for Orders' cross-context ProductLookupRepository
 * port. Seed with `.seed(summary)`; `decrementStock` mutates the seeded
 * summary in place so tests can assert on post-webhook stock levels. */
export class FakeProductLookupRepository implements ProductLookupRepository {
  private readonly variants = new Map<string, ProductVariantSummary>();

  seed(variant: ProductVariantSummary): void {
    this.variants.set(variant.id, variant);
  }

  findVariantById(id: string): Promise<ProductVariantSummary | null> {
    return Promise.resolve(this.variants.get(id) ?? null);
  }

  decrementStock(variantId: string, quantity: number): Promise<void> {
    const variant = this.variants.get(variantId);
    if (variant) {
      variant.stockQuantity -= quantity;
    }
    return Promise.resolve();
  }

  stockOf(variantId: string): number | undefined {
    return this.variants.get(variantId)?.stockQuantity;
  }
}

export class FakeAddressLookupRepository implements AddressLookupRepository {
  private readonly addresses: AddressSummary[] = [];

  seed(address: AddressSummary): void {
    this.addresses.push(address);
  }

  findById(id: string): Promise<AddressSummary | null> {
    return Promise.resolve(this.addresses.find((a) => a.id === id) ?? null);
  }
}

export class FakePaymentGateway implements PaymentGatewayPort {
  public calls: CreateGatewayOrderInput[] = [];
  public nextGatewayOrderId = 'order_stub_fake123';
  public refundCalls: RefundInput[] = [];
  public nextRefundId = 'rfnd_stub_fake123';

  createOrder(
    input: CreateGatewayOrderInput,
  ): Promise<CreateGatewayOrderResult> {
    this.calls.push(input);
    return Promise.resolve({ gatewayOrderId: this.nextGatewayOrderId });
  }

  refund(input: RefundInput): Promise<RefundResult> {
    this.refundCalls.push(input);
    return Promise.resolve({ refundId: this.nextRefundId });
  }
}

/** Deterministic fake signature verifier for tests — avoids needing real
 * HMAC plumbing in use-case-level tests (the real RazorpayWebhookSigner
 * has its own dedicated unit tests, see razorpay-webhook-signer.spec.ts).
 * Configure `validSignature` to control pass/fail per test. */
export class FakeWebhookSignatureVerifier implements WebhookSignatureVerifierPort {
  constructor(private validSignature = 'valid-signature') {}

  verify(_rawBody: string, signatureHeader: string | undefined): boolean {
    return signatureHeader === this.validSignature;
  }
}

export class FakeAuditLogger implements AuditLogger {
  public readonly events: AuditEvent[] = [];

  record(event: AuditEvent): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }
}

/** In-memory stand-in for Orders' own cross-context VendorLookupRepository
 * port (FR-ORD-006). Seed with `.seed(summary)`. */
export class FakeOrdersVendorLookupRepository implements VendorLookupRepository {
  private readonly vendors: OrdersVendorSummary[] = [];

  seed(vendor: OrdersVendorSummary): void {
    this.vendors.push(vendor);
  }

  findByOwnerUserId(ownerUserId: string): Promise<OrdersVendorSummary | null> {
    return Promise.resolve(
      this.vendors.find((v) => v.ownerUserId === ownerUserId) ?? null,
    );
  }
}

/** In-memory stand-in for Orders' own cross-context OrdersUserRolesRepository
 * port (FR-ORD-005 admin check). Seed admin user ids with `.grantAdmin(id)`. */
export class FakeOrdersUserRolesRepository implements OrdersUserRolesRepository {
  private readonly admins = new Set<string>();

  grantAdmin(userId: string): void {
    this.admins.add(userId);
  }

  hasAdminRole(userId: string): Promise<boolean> {
    return Promise.resolve(this.admins.has(userId));
  }
}
