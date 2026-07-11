import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { CartController } from './interface/controllers/cart.controller';
import { CheckoutController } from './interface/controllers/checkout.controller';
import { OrdersController } from './interface/controllers/orders.controller';
import { RazorpayWebhookController } from './interface/controllers/razorpay-webhook.controller';

import { GetCartUseCase } from './application/use-cases/get-cart.use-case';
import { AddCartLineUseCase } from './application/use-cases/add-cart-line.use-case';
import { UpdateCartLineUseCase } from './application/use-cases/update-cart-line.use-case';
import { RemoveCartLineUseCase } from './application/use-cases/remove-cart-line.use-case';
import { CheckoutQuoteUseCase } from './application/use-cases/checkout-quote.use-case';
import { CheckoutUseCase } from './application/use-cases/checkout.use-case';
import { ProcessRazorpayWebhookUseCase } from './application/use-cases/process-razorpay-webhook.use-case';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case';
import { CartPricingService } from './application/services/cart-pricing.service';

import { CART_REPOSITORY } from './domain/repositories/cart.repository';
import { PrismaCartRepository } from './infrastructure/persistence/prisma-cart.repository';
import { ORDER_REPOSITORY } from './domain/repositories/order.repository';
import { PrismaOrderRepository } from './infrastructure/persistence/prisma-order.repository';
import { PRODUCT_LOOKUP_REPOSITORY } from './domain/repositories/product-lookup.repository';
import { PrismaProductLookupRepository } from './infrastructure/persistence/prisma-product-lookup.repository';
import { ADDRESS_LOOKUP_REPOSITORY } from './domain/repositories/address-lookup.repository';
import { PrismaAddressLookupRepository } from './infrastructure/persistence/prisma-address-lookup.repository';

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
 * (order.placed / order.paid / order.webhook_signature_invalid events),
 * same pattern as Vendor/Product. Reaches into Product's and User's data
 * ONLY through Orders-owned read ports (ProductLookupRepository,
 * AddressLookupRepository) — never by importing ProductModule/UserModule
 * or their internal repositories/entities directly, per Constitution §6.2
 * ("Respect module boundaries; do not import across bounded contexts").
 */
@Module({
  imports: [IdentityModule],
  controllers: [
    CartController,
    CheckoutController,
    OrdersController,
    RazorpayWebhookController,
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
    { provide: PAYMENT_GATEWAY, useClass: StubRazorpayGateway },
    { provide: WEBHOOK_SIGNATURE_VERIFIER, useClass: RazorpayWebhookSigner },
  ],
})
export class OrdersModule {}
