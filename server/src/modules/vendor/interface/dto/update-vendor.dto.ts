import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

// FR-VND-003 — store profile fields only. All optional (PATCH semantics:
// only supplied fields are updated).
export class UpdateVendorDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl()
  logoUrl?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl()
  bannerUrl?: string | null;
}
