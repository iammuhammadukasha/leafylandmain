import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CartController } from './interface/controllers/cart.controller';
import { CheckoutController } from './interface/controllers/checkout.controller';
import { OrdersController } from './interface/controllers/orders.controller';
import { RazorpayWebhookController } from './interface/controllers/razorpay-webhook.controller';
import { VendorOrdersController } from './interface/controllers/vendor-orders.controller';

import { GetCartUseCase } from './application/use-cases/get-cart.use-case';
import { AddCartLineUseCase } from './application/use-cases/add-cart-line.use-case';
import { UpdateCartLineUseCase } from './application/use-cases/update-cart-line.use-case';
import { RemoveCartLineUseCase } from './application/use-cases/remove-cart-line.use-case';
import { CheckoutQuoteUseCase } from './application/use-cases/checkout-quote.use-case';
import { CheckoutUseCase } from './application/use-cases/checkout.use-case';
import { ProcessRazorpayWebhookUseCase } from './application/use-cases/process-razorpay-webhook.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { ListVendorOrderLinesUseCase } from './application/use-cases/list-vendor-order-lines.use-case';
import { ShipOrderLineUseCase } from './application/use-cases/ship-order-line.use-case';
import { DeliverShipmentUseCase } from './application/use-cases/deliver-shipment.use-case';
import { CartPricingService } from './application/services/cart-pricing.service';

import { CART_REPOSITORY } from './domain/repositories/cart.repository';
import { PrismaCartRepository } from './infrastructure/persistence/prisma-cart.repository';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository';
import { PrismaOrderRepository } from './infrastructure/persistence/prisma-order.repository';
import { PRODUCT_LOOKUP_REPOSITORY } from './domain/repositories/product-lookup.repository';
import { PrismaProductLookupRepository } from './infrastructure/persistence/prisma-product-lookup.repository';
import { ADDRESS_LOOKUP_REPOSITORY } from './domain/repositories/address-lookup.repository';
import { PrismaAddressLookupRepository } from './infrastructure/persistence/prisma-address-lookup.repository';
import { SHIPMENT_REPOSITORY } from './domain/repositories/shipment.repository';
import { PrismaShipmentRepository } from './infrastructure/persistence/prisma-shipment.repository';
import { VENDOR_LOOKUP_REPOSITORY } from './domain/repositories/vendor-lookup.repository';
import { PrismaOrdersVendorLookupRepository } from './infrastructure/persistence/prisma-vendor-lookup.repository';
import { VENDOR_ORDER_LINE_VIEW_REPOSITORY } from './domain/repositories/vendor-order-line-view.repository';
import { PrismaVendorOrderLineViewRepository } from './infrastructure/persistence/prisma-vendor-order-line-view.repository';

import {
  PAYMENT_GATEWAY,
  WEBHOOK_SIGNATURE_VERIFIER,
} from './application/ports/payment-gateway.port';
import { StubRazorpayGateway } from './infrastructure/payment/stub-razorpay-gateway';
import { RazorpayWebhookSigner } from './infrastructure/payment/razorpay-webhook-signer';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Orders bounded-context module (Architecture §3/§4, Volume 02 §6). Imports
 * IdentityModule for ACCESS_TOKEN_SERVICE (JwtAuthGuard) and AUDIT_LOGGER
 * (order.placed / order.paid / order.webhook_signature_invalid /
 * order.shipped / order.delivered events), same pattern as Vendor/Product.
 * Reaches into Product's and Vendor's data ONLY through Orders-owned read
 * ports (ProductLookupRepository, AddressLookupRepository, and — new for
 * FR-ORD-006 — VendorLookupRepository, this module's own thin read-only
 * port over the `vendors` table, exact mirror of Product's own
 * VendorLookupRepository) — never by importing ProductModule/VendorModule
 * or their internal repositories/entities directly, per Constitution §6.2
 * ("Respect module boundaries; do not import across bounded contexts").
 * Unlike Product, Orders does NOT import VendorModule at all — it doesn't
 * need USER_ROLES_REPOSITORY (vendor_staff role checks), since vendor
 * fulfillment in this slice is scoped the same "vendor_owner only,
 * vendor_staff deferred" way as Vendor's own GetMyVendorUseCase (see
 * ListVendorOrderLinesUseCase's doc comment).
 *
 * FR-ORD-006 (vendor order fulfillment) adds: SHIPMENT_REPOSITORY (owns
 * `shipments`), VENDOR_LOOKUP_REPOSITORY (Orders' own vendor-ownership
 * read port), and VENDOR_ORDER_LINE_VIEW_REPOSITORY (the flat paginated
 * read model backing GET /vendors/me/orders — see that port's doc comment
 * for why it's separate from ORDER_REPOSITORY).
 */
@Module({
  imports: [IdentityModule],
  controllers: [
    CartController,
    CheckoutController,
    OrdersController,
    RazorpayWebhookController,
    VendorOrdersController,
  ],
  providers: [
    GetCartUseCase,
    AddCartLineUseCase,
    UpdateCartLineUseCase,
    RemoveCartLineUseCase,
    CheckoutQuoteUseCase,
    CheckoutUseCase,
    ProcessRazorpayWebhookUseCase,
    GetOrderUseCase,
    ListVendorOrderLinesUseCase,
    ShipOrderLineUseCase,
    DeliverShipmentUseCase,
    CartPricingService,
    JwtAuthGuard,
    { provide: CART_REPOSITORY, useClass: PrismaCartRepository },
    { provide: ORDER_REPOSITORY, useClass: PrismaOrderRepository },
    {
      provide: PRODUCT_LOOKUP_REPOSITORY,
      useClass: PrismaProductLookupRepository,
    },
    {
      provide: ADDRESS_LOOKUP_REPOSITORY,
      useClass: PrismaAddressLookupRepository,
    },
    { provide: SHIPMENT_REPOSITORY, useClass: PrismaShipmentRepository },
    {
      provide: VENDOR_LOOKUP_REPOSITORY,
      useClass: PrismaOrdersVendorLookupRepository,
    },
    {
      provide: VENDOR_ORDER_LINE_VIEW_REPOSITORY,
      useClass: PrismaVendorOrderLineViewRepository,
    },
    { provide: PAYMENT_GATEWAY, useClass: StubRazorpayGateway },
    { provide: WEBHOOK_SIGNATURE_VERIFIER, useClass: RazorpayWebhookSigner },
  ],
})
export class OrdersModule {}
