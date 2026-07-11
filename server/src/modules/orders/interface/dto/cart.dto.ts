import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class AddCartLineDto {
  @ApiProperty()
  @IsUUID()
  productVariantId!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class UpdateCartLineDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CartLineResponseDto {
  @ApiProperty()
  productVariantId!: string;

  @ApiProperty()
  quantity!: number;
}

export class CartResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: ['active', 'converted', 'abandoned'] })
  status!: 'active' | 'converted' | 'abandoned';

  @ApiProperty({ type: [CartLineResponseDto] })
  lines!: CartLineResponseDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
