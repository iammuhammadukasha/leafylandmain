import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Signed verification token from the email link' })
  @IsString()
  @MinLength(1)
  token!: string;
}

export class VerifyEmailResponseDto {
  @ApiProperty()
  message!: string;
}
