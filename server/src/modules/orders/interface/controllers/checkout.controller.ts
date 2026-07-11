import { Body, Controller, Ip, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AccessTokenClaims } from '../../../identity/application/ports/access-token.port';
import { CheckoutQuoteUseCase } from '../../application/use-cases/checkout-quote.use-case';
import { CheckoutUseCase } from '../../application/use-cases/checkout.use-case';
import type { CartQuote } from '../../application/services/cart-pricing.service';
import {
  CheckoutDto,
  CheckoutQuoteResponseDto,
  CheckoutResponseDto,
} from '../dto/checkout.dto';
import { mapOrderError } from '../order-error.mapper';

/**
 * Checkout endpoints (Volume 07 §6.2, FR-ORD-002/FR-ORD-007). Interface
 * layer: HTTP concerns only, no business logic (Constitution §6).
 *
 * DEFERRED vs API Spec §6.2's documented checkout body: `cartId` (this
 * slice's checkout always operates on the caller's own active cart,
 * looked up server-side — accepting a client-supplied cartId would let a
 * caller name someone else's cart id, which the endpoint would then need
 * its own ownership check for; simpler and safer to never accept it),
 * `shippingMethod` (no shipping-method selection exists, flat stub
 * shipping per CartPricingService), `couponCode` (coupons don't exist
 * yet, Product Marketplace slice didn't model them). All per the task
 * brief's explicit scope reduction.
 */
@ApiTags('checkout')
@ApiBearerAuth()
@Controller('api/v1/orders/checkout')
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(
    private readonly checkoutQuote: CheckoutQuoteUseCase,
    private readonly checkout: CheckoutUseCase,
  ) {}

  @Post('quote')
  @ApiOperation({
    summary:
      'Re-validate price/stock and compute a checkout quote (FR-ORD-002, FR-ORD-007)',
    description:
      'Read-only — does not create an order. Tax is a flat category-taxRateBps calc (no CGST/SGST/IGST splitting). Shipping is a flat stub amount.',
  })
  @ApiResponse({ status: 200, type: CheckoutQuoteResponseDto })
  async quoteHandler(
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<CheckoutQuoteResponseDto> {
    try {
      const result = await this.checkoutQuote.execute({ userId: user.sub });
      return this.toQuoteResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  @Post()
  @ApiOperation({
    summary:
      "Create a pending_payment order from the caller's cart (FR-ORD-002)",
    description:
      'Re-runs the same validation as /quote (never trusts a stale client quote). Creates Order+OrderLines in a transaction, calls the stub payment gateway, returns the gateway order id for the client to proceed to payment.',
  })
  @ApiResponse({ status: 201, type: CheckoutResponseDto })
  async checkoutHandler(
    @Body() dto: CheckoutDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<CheckoutResponseDto> {
    try {
      return await this.checkout.execute({
        userId: user.sub,
        shippingAddressId: dto.shippingAddressId,
        billingAddressId: dto.billingAddressId,
        ipAddress: ip,
      });
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  private toQuoteResponseDto(quote: CartQuote): CheckoutQuoteResponseDto {
    return {
      lines: quote.lines.map((line) => ({
        productVariantId: line.productVariantId,
        sku: line.sku,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor.toString(),
        lineSubtotalMinor: line.lineSubtotalMinor.toString(),
        lineTaxMinor: line.lineTaxMinor.toString(),
        categoryTaxRateBps: line.categoryTaxRateBps,
      })),
      subtotalMinor: quote.subtotalMinor.toString(),
      taxMinor: quote.taxMinor.toString(),
      shippingMinor: quote.shippingMinor.toString(),
      totalMinor: quote.totalMinor.toString(),
    };
  }
}
