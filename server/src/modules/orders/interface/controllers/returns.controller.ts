import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
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
import { RequestReturnUseCase } from '../../application/use-cases/request-return.use-case';
import { ApproveReturnUseCase } from '../../application/use-cases/approve-return.use-case';
import { RejectReturnUseCase } from '../../application/use-cases/reject-return.use-case';
import type { ReturnProps } from '../../domain/entities/return.entity';
import {
  RejectReturnDto,
  RequestReturnDto,
  ReturnResponseDto,
} from '../dto/return.dto';
import { mapOrderError } from '../order-error.mapper';

/**
 * Returns & refunds (FR-ORD-005, API Spec §6.4). Interface layer: HTTP
 * concerns only, no business logic (Constitution §6) — mirrors
 * VendorOrdersController's shape: JwtAuthGuard at controller level,
 * ownership/authorization all resolved inside each use case (buyer
 * ownership for request-return; vendor-ownership-OR-admin for
 * approve/reject), never via a route guard.
 *
 * Base path matches API Spec §6.4 literally: `/api/v1/orders/lines/...` and
 * `/api/v1/orders/returns/...` both hang off the same `/api/v1/orders`
 * controller prefix as OrdersController's `/api/v1/orders/:orderId`, kept
 * as a SEPARATE controller class (not added to OrdersController) purely for
 * file-size/cohesion reasons — same "one controller per API sub-area"
 * pattern CheckoutController/CartController already split within this one
 * module.
 */
@ApiTags('orders-returns')
@ApiBearerAuth()
@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard)
export class ReturnsController {
  constructor(
    private readonly requestReturn: RequestReturnUseCase,
    private readonly approveReturn: ApproveReturnUseCase,
    private readonly rejectReturn: RejectReturnUseCase,
  ) {}

  @Post('lines/:orderLineId/return')
  @ApiOperation({
    summary: 'Request a return on a fulfilled order line (FR-ORD-005)',
    description:
      "Buyer-only: the order line must belong to the caller and be `fulfilled`. Rejected 422 RETURN_WINDOW_EXPIRED if the line isn't fulfilled yet or the 7-day return window has elapsed since delivery. Rejected 409 RETURN_ALREADY_EXISTS if a return already exists for this line.",
  })
  @ApiResponse({ status: 201, type: ReturnResponseDto })
  @HttpCode(HttpStatus.CREATED)
  async requestHandler(
    @Param('orderLineId') orderLineId: string,
    @Body() dto: RequestReturnDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ReturnResponseDto> {
    try {
      const result = await this.requestReturn.execute({
        userId: user.sub,
        orderLineId,
        reason: dto.reason,
        ipAddress: ip,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  @Post('returns/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a requested return, triggering a refund (FR-ORD-005)',
    description:
      'Authorized for the owning vendor (vendor_owner/vendor_staff) or admin. Transitions requested -> approved -> refunded in one call: issues a stub Razorpay refund for the line amount, records the refund id, and flips the order line to `refunded`. 422 RETURN_NOT_REQUESTED if the return was already resolved.',
  })
  @ApiResponse({ status: 200, type: ReturnResponseDto })
  async approveHandler(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ReturnResponseDto> {
    try {
      const result = await this.approveReturn.execute({
        actorUserId: user.sub,
        returnId: id,
        ipAddress: ip,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  @Post('returns/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a requested return (FR-ORD-005)',
    description:
      'Authorized for the owning vendor (vendor_owner/vendor_staff) or admin. Transitions requested -> rejected. The order line status is left untouched (stays `fulfilled`) — a rejected return is not a refund.',
  })
  @ApiResponse({ status: 200, type: ReturnResponseDto })
  async rejectHandler(
    @Param('id') id: string,
    @Body() dto: RejectReturnDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ReturnResponseDto> {
    try {
      const result = await this.rejectReturn.execute({
        actorUserId: user.sub,
        returnId: id,
        reason: dto.reason,
        ipAddress: ip,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  private toResponseDto(returnEntity: ReturnProps): ReturnResponseDto {
    return {
      id: returnEntity.id,
      orderLineId: returnEntity.orderLineId,
      reason: returnEntity.reason,
      status: returnEntity.status,
      resolvedBy: returnEntity.resolvedBy,
      refundId: returnEntity.refundId,
      createdAt: returnEntity.createdAt.toISOString(),
    };
  }
}
