import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AccessTokenClaims } from '../../../identity/application/ports/access-token.port';
import { GetCartUseCase } from '../../application/use-cases/get-cart.use-case';
import { AddCartLineUseCase } from '../../application/use-cases/add-cart-line.use-case';
import { UpdateCartLineUseCase } from '../../application/use-cases/update-cart-line.use-case';
import { RemoveCartLineUseCase } from '../../application/use-cases/remove-cart-line.use-case';
import type { CartProps } from '../../domain/entities/cart.entity';
import {
  AddCartLineDto,
  CartResponseDto,
  UpdateCartLineDto,
} from '../dto/cart.dto';
import { mapOrderError } from '../order-error.mapper';

/**
 * Cart endpoints (Volume 07 §6.1, FR-ORD-001). Auth-only for this slice —
 * guest cart via cookie/id (API Spec §6.1's "Public (guest cart via
 * cookie/id) or Auth") is explicitly deferred, per the task brief. Cart
 * merge-on-login (POST /cart/merge) is also deferred since there is no
 * guest cart to merge from.
 *
 * Interface layer: HTTP concerns only, no business logic (Constitution
 * §6) — mirrors VendorProductController's shape exactly.
 */
@ApiTags('cart')
@ApiBearerAuth()
@Controller('api/v1/orders/cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(
    private readonly getCart: GetCartUseCase,
    private readonly addCartLine: AddCartLineUseCase,
    private readonly updateCartLine: UpdateCartLineUseCase,
    private readonly removeCartLine: RemoveCartLineUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Get the caller's active cart, creating one if none exists (FR-ORD-001)",
  })
  @ApiResponse({ status: 200, type: CartResponseDto })
  async getHandler(
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<CartResponseDto> {
    try {
      const result = await this.getCart.execute({ userId: user.sub });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  @Post('lines')
  @ApiOperation({
    summary: 'Add or increment a cart line (FR-ORD-001)',
    description:
      'Confirms the variant exists and belongs to an active product before adding, else 422 BUSINESS_RULE_VIOLATION.',
  })
  @ApiResponse({ status: 201, type: CartResponseDto })
  async addLineHandler(
    @Body() dto: AddCartLineDto,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<CartResponseDto> {
    try {
      const result = await this.addCartLine.execute({
        userId: user.sub,
        productVariantId: dto.productVariantId,
        quantity: dto.quantity,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  @Patch('lines/:variantId')
  @ApiOperation({ summary: 'Update a cart line quantity (FR-ORD-001)' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  async updateLineHandler(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateCartLineDto,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<CartResponseDto> {
    try {
      const result = await this.updateCartLine.execute({
        userId: user.sub,
        productVariantId: variantId,
        quantity: dto.quantity,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  @Delete('lines/:variantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a cart line (FR-ORD-001)' })
  @ApiResponse({ status: 200, type: CartResponseDto })
  async removeLineHandler(
    @Param('variantId') variantId: string,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<CartResponseDto> {
    try {
      const result = await this.removeCartLine.execute({
        userId: user.sub,
        productVariantId: variantId,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  private toResponseDto(cart: CartProps): CartResponseDto {
    return {
      id: cart.id,
      userId: cart.userId,
      status: cart.status,
      lines: cart.lines.map((line) => ({
        productVariantId: line.productVariantId,
        quantity: line.quantity,
      })),
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
    };
  }
}
