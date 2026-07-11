import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description:
      'The order line proving purchase — must belong to the caller, be for a variant of this product, and its order must be paid (FR-PRD-004).',
  })
  @IsUUID()
  orderLineId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ example: 'Great quality, fast delivery.' })
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  body!: string;
}

export class ReviewResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  orderLineId!: string;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
