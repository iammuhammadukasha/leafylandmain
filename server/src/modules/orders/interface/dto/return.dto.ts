import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestReturnDto {
  @ApiProperty({ description: 'Buyer-provided reason for the return' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class RejectReturnDto {
  @ApiProperty({ description: 'Vendor/admin-provided reason for rejection' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

export class ReturnResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  orderLineId!: string;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ enum: ['requested', 'approved', 'rejected', 'refunded'] })
  status!: 'requested' | 'approved' | 'rejected' | 'refunded';

  @ApiProperty({ nullable: true, type: String })
  resolvedBy!: string | null;

  @ApiProperty({ nullable: true, type: String })
  refundId!: string | null;

  @ApiProperty()
  createdAt!: string;
}
