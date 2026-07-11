import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AccessTokenClaims } from '../../../identity/application/ports/access-token.port';
import { GetOrderUseCase } from '../../application/use-cases/get-order.use-case';
import type { OrderProps } from '../../domain/entities/order.entity';
import { OrderResponseDto } from '../dto/order.dto';
import { mapOrderError } from '../order-error.mapper';

/**
 * GET /api/v1/orders/:orderId (Volume 07 §6.2, FR-ORD-002). Auth, owner
 * only for this slice — API Spec §6.2 lists "Auth (owner) or admin" but no
 * admin role/claim check is wired anywhere yet in this codebase (RBAC,
 * FR-ID-006, is out of scope), so the admin branch is simply not built;
 * only the owner path exists.
 */
@ApiTags('orders')
@ApiBearerAuth()
@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly getOrder: GetOrderUseCase) {}

  @Get(':orderId')
  @ApiOperation({
    summary: 'Get an order by id, owner-only (FR-ORD-002)',
    description:
      'Returns 403 for a caller who is not the order owner, 404 if the order does not exist.',
  })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  async getHandler(
    @Param('orderId') orderId: string,
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<OrderResponseDto> {
    try {
      const result = await this.getOrder.execute({
        userId: user.sub,
        orderId,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  private toResponseDto(order: OrderProps): OrderResponseDto {
    return {
      id: order.id,
      userId: order.userId,
      shippingAddressId: order.shippingAddressId,
      billingAddressId: order.billingAddressId,
      status: order.status,
      subtotalMinor: order.subtotalMinor.toString(),
      taxMinor: order.taxMinor.toString(),
      shippingMinor: order.shippingMinor.toString(),
      totalMinor: order.totalMinor.toString(),
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      lines: order.lines.map((line) => ({
        id: line.id,
        productVariantId: line.productVariantId,
        vendorId: line.vendorId,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor.toString(),
        taxMinor: line.taxMinor.toString(),
        status: line.status,
      })),
      createdAt: order.createdAt.toISOString(),
    };
  }
}
