import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'shopper@example.com' })
  @IsEmail()
  email!: string;

  // VR: min 10 chars enforced here for fast feedback; the domain rule
  // (RegisterUserUseCase.validatePasswordStrength, incl. common-password
  // check) is the source of truth and is re-checked in the use case.
  @ApiProperty({ example: 'correct-horse-battery-staple', minLength: 10 })
  @IsString()
  @MinLength(10)
  password!: string;
}

export class RegisterResponseDto {
  @ApiProperty()
  message!: string;
}
