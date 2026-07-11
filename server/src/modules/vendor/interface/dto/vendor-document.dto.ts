import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsUrl, MaxLength } from 'class-validator';

const VENDOR_DOCUMENT_TYPES = [
  'business_registration',
  'organic_certificate',
  'other',
] as const;

// FR-VND-008 (minimal slice) — no multipart upload/S3 integration; fileUrl
// just accepts a string URL, per the task's stated scope reduction.
export class CreateVendorDocumentDto {
  @ApiProperty({ enum: VENDOR_DOCUMENT_TYPES })
  @IsIn(VENDOR_DOCUMENT_TYPES)
  type!: 'business_registration' | 'organic_certificate' | 'other';

  @ApiProperty({ example: 'https://example.com/documents/cert.pdf' })
  @IsUrl()
  @MaxLength(2000)
  fileUrl!: string;

  @ApiProperty({ required: false, nullable: true, type: String })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class VendorDocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  vendorId!: string;

  @ApiProperty({ enum: VENDOR_DOCUMENT_TYPES })
  type!: 'business_registration' | 'organic_certificate' | 'other';

  @ApiProperty()
  fileUrl!: string;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected'] })
  reviewStatus!: 'pending' | 'approved' | 'rejected';

  @ApiProperty({ nullable: true, type: String })
  expiresAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class VendorDocumentListResponseDto {
  @ApiProperty({ type: [VendorDocumentResponseDto] })
  items!: VendorDocumentResponseDto[];
}
