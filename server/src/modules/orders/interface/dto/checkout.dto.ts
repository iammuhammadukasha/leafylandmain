import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CheckoutDto {
  @ApiProperty()
  @IsUUID()
  shippingAddressId!: string;

  @ApiProperty()
  @IsUUID()
  billingAddressId!: string;
}

export class QuotedLineResponseDto {
  @ApiProperty()
  productVariantId!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  unitPriceMinor!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  lineSubtotalMinor!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  lineTaxMinor!: string;

  @ApiProperty()
  categoryTaxRateBps!: number;
}

export class CheckoutQuoteResponseDto {
  @ApiProperty({ type: [QuotedLineResponseDto] })
  lines!: QuotedLineResponseDto[];

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  subtotalMinor!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  taxMinor!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  shippingMinor!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  totalMinor!: string;
}

export class CheckoutResponseDto {
  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  gatewayOrderId!: string;

  @ApiProperty({ description: 'Minor units (paise), as a string' })
  amountMinor!: string;
}
