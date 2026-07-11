import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyVendorDto {
  @ApiProperty({ enum: ['approved', 'rejected', 'more_info'] })
  @IsIn(['approved', 'rejected', 'more_info'])
  decision!: 'approved' | 'rejected' | 'more_info';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
