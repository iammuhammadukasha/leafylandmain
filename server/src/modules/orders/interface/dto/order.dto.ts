import { ApiProperty } from '@nestjs/swagger';

export class OrderLineResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productVariantId!: string;

  @ApiProperty()
  vendorId!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  unitPriceMinor!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  taxMinor!: string;

  @ApiProperty({ enum: ['pending', 'fulfilled', 'returned', 'refunded'] })
  status!: 'pending' | 'fulfilled' | 'returned' | 'refunded';
}

export class OrderResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  shippingAddressId!: string;

  @ApiProperty()
  billingAddressId!: string;

  @ApiProperty({
    enum: [
      'pending_payment',
      'paid',
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
    ],
  })
  status!:
    | 'pending_payment'
    | 'paid'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded';

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  subtotalMinor!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  taxMinor!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  shippingMinor!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  totalMinor!: string;

  @ApiProperty({ nullable: true, type: String })
  razorpayOrderId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  razorpayPaymentId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  paidAt!: string | null;

  @ApiProperty({ type: [OrderLineResponseDto] })
  lines!: OrderLineResponseDto[];

  @ApiProperty()
  createdAt!: string;
}
