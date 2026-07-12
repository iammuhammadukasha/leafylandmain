import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ShipOrderLineDto {
  @ApiProperty({ description: 'Carrier name, e.g. "BlueDart"' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  carrier!: string;

  @ApiProperty({ description: 'Carrier tracking number' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  trackingNumber!: string;
}

export class VendorOrderLineResponseDto {
  @ApiProperty()
  orderLineId!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  productVariantId!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  unitPriceMinor!: string;

  @ApiProperty({ enum: ['pending', 'fulfilled', 'returned', 'refunded'] })
  lineStatus!: 'pending' | 'fulfilled' | 'returned' | 'refunded';

  @ApiProperty({
    enum: ['pending', 'shipped', 'delivered'],
    nullable: true,
    type: String,
    description: 'null when no shipment has been created yet',
  })
  shipmentStatus!: 'pending' | 'shipped' | 'delivered' | null;

  @ApiProperty()
  createdAt!: string;
}

export class VendorOrderLineListMetaDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  total!: number;
}

export class ShipmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  vendorId!: string;

  @ApiProperty({ nullable: true, type: String })
  carrier!: string | null;

  @ApiProperty({ nullable: true, type: String })
  trackingNumber!: string | null;

  @ApiProperty({ enum: ['pending', 'shipped', 'delivered'] })
  status!: 'pending' | 'shipped' | 'delivered';
}
