import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @ApiProperty({ example: 'Organic Basmati Rice 1kg' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  isOrganicClaim!: boolean;

  // BR-PRD-01 — required (and validated against an approved
  // organic_certificate document belonging to the caller's vendor, in the
  // application layer) when isOrganicClaim is true.
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  organicCertDocumentId?: string;
}

export class UpdateProductDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUUID()
  brandId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  title?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}

export class ProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  vendorId!: string;

  @ApiProperty()
  categoryId!: string;

  @ApiProperty({ nullable: true, type: String })
  brandId!: string | null;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  isOrganicClaim!: boolean;

  @ApiProperty({ nullable: true, type: String })
  organicCertDocumentId!: string | null;

  @ApiProperty({ enum: ['draft', 'active', 'delisted'] })
  status!: 'draft' | 'active' | 'delisted';

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ProductListResponseDto {
  @ApiProperty({ type: [ProductResponseDto] })
  items!: ProductResponseDto[];
}

export class CreateProductVariantDto {
  @ApiProperty({ example: 'RICE-BAS-1KG' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku!: string;

  @ApiProperty({ example: { size: '1kg' }, type: Object })
  @IsOptional()
  attributes?: Record<string, unknown>;

  @ApiProperty({ example: 49900, description: 'Price in minor units (paise)' })
  @IsInt()
  @Min(0)
  priceMinor!: number;

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  lowStockThreshold!: number;
}

export class UpdateProductVariantDto {
  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  attributes?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}

export class ProductVariantResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ type: Object })
  attributes!: Record<string, unknown>;

  @ApiProperty({
    description:
      'Price in minor units (paise), as a string to avoid bigint/JSON precision loss',
  })
  priceMinor!: string;

  @ApiProperty()
  stockQuantity!: number;

  @ApiProperty()
  lowStockThreshold!: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
