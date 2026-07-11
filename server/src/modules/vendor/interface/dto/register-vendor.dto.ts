import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterVendorDto {
  @ApiProperty({ example: 'Green Leaf Organics' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class VendorResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ownerUserId!: string;

  @ApiProperty()
  businessName!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ nullable: true, type: String })
  logoUrl!: string | null;

  @ApiProperty({ nullable: true, type: String })
  bannerUrl!: string | null;

  @ApiProperty({ enum: ['pending', 'verified', 'rejected', 'revoked'] })
  status!: 'pending' | 'verified' | 'rejected' | 'revoked';

  @ApiProperty({ nullable: true, type: Number })
  commissionRateBps!: number | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  verifiedAt!: string | null;

  @ApiProperty({ nullable: true, type: String })
  rejectedReason!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
