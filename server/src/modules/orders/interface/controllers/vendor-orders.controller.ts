import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Query,
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
import { ListVendorOrderLinesUseCase } from '../../application/use-cases/list-vendor-order-lines.use-case';
import { ShipOrderLineUseCase } from '../../application/use-cases/ship-order-line.use-case';
import { DeliverShipmentUseCase } from '../../application/use-cases/deliver-shipment.use-case';
import type { VendorOrderLineView } from '../../domain/repositories/vendor-order-line-view.repository';
import type { ShipmentProps } from '../../domain/entities/shipment.entity';
import {
  ShipmentResponseDto,
  ShipOrderLineDto,
  VendorOrderLineListMetaDto,
  VendorOrderLineResponseDto,
} from '../dto/vendor-order.dto';
import { mapOrderError } from '../order-error.mapper';

/**
 * Vendor order fulfillment (FR-ORD-006, API Spec §6.3). Interface layer:
 * HTTP concerns only, no business logic (Constitution §6) — mirrors
 * VendorProductController's shape exactly: JwtAuthGuard at controller
 * level, vendor-ownership itself checked inside each use case via Orders'
 * own VendorLookupRepository (structural scoping, not a route guard —
 * same precedent as every other vendor-scoped controller in this
 * codebase).
 */
@ApiTags('vendor-orders')
@ApiBearerAuth()
@Controller('api/v1/vendors/me/orders')
@UseGuards(JwtAuthGuard)
export class VendorOrdersController {
  constructor(
    private readonly listVendorOrderLines: ListVendorOrderLinesUseCase,
    private readonly shipOrderLine: ShipOrderLineUseCase,
    private readonly deliverShipment: DeliverShipmentUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "List the caller's vendor order lines, across all buyers' orders (FR-ORD-006)",
  })
  @ApiResponse({ status: 200, type: [VendorOrderLineResponseDto] })
  async listHandler(
    @CurrentUser() user: AccessTokenClaims,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{
    __envelope: true;
    data: VendorOrderLineResponseDto[];
    meta: VendorOrderLineListMetaDto;
  }> {
    try {
      const parsedPage = page ? Math.max(parseInt(page, 10) || 1, 1) : 1;
      const parsedPageSize = pageSize
        ? Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100)
        : 20;

      const result = await this.listVendorOrderLines.execute({
        userId: user.sub,
        page: parsedPage,
        pageSize: parsedPageSize,
      });

      return {
        __envelope: true,
        data: result.items.map((item) => this.toLineResponseDto(item)),
        meta: {
          page: parsedPage,
          pageSize: parsedPageSize,
          total: result.total,
        },
      };
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  @Post(':orderLineId/ship')
  @ApiOperation({
    summary: 'Mark a vendor-owned order line shipped (FR-ORD-006)',
    description:
      "Creates or updates the shipments row for this (order, vendor) pair — one shipment per vendor per order, so this marks ALL of the caller vendor's lines on this order as shipped-via-this-shipment. Only a paid order is shippable, else 422 ORDER_NOT_PAID. A line belonging to a different vendor is rejected 403 FORBIDDEN with no data leak.",
  })
  @ApiResponse({ status: 200, type: ShipmentResponseDto })
  async shipHandler(
    @Param('orderLineId') orderLineId: string,
    @Body() dto: ShipOrderLineDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ShipmentResponseDto> {
    try {
      const result = await this.shipOrderLine.execute({
        userId: user.sub,
        orderLineId,
        carrier: dto.carrier,
        trackingNumber: dto.trackingNumber,
        ipAddress: ip,
      });
      return this.toShipmentResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  @Post(':orderLineId/deliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a shipment delivered (FR-ORD-006)',
    description:
      'Only callable after ship (a shipped shipment must already exist for this order+vendor), else 422 SHIPMENT_NOT_SHIPPED. On success, flips every pending order_line for this vendor on this order to fulfilled.',
  })
  @ApiResponse({ status: 200, type: ShipmentResponseDto })
  async deliverHandler(
    @Param('orderLineId') orderLineId: string,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ShipmentResponseDto> {
    try {
      const result = await this.deliverShipment.execute({
        userId: user.sub,
        orderLineId,
        ipAddress: ip,
      });
      return this.toShipmentResponseDto(result);
    } catch (error) {
      throw mapOrderError(error);
    }
  }

  private toLineResponseDto(
    line: VendorOrderLineView,
  ): VendorOrderLineResponseDto {
    return {
      orderLineId: line.orderLineId,
      orderId: line.orderId,
      productVariantId: line.productVariantId,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor.toString(),
      lineStatus: line.lineStatus,
      shipmentStatus: line.shipmentStatus,
      createdAt: line.createdAt.toISOString(),
    };
  }

  private toShipmentResponseDto(shipment: ShipmentProps): ShipmentResponseDto {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      vendorId: shipment.vendorId,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
    };
  }
}
