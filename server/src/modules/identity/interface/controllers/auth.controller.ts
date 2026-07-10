import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { RegisterDto, RegisterResponseDto } from '../dto/register.dto';
import {
  VerifyEmailDto,
  VerifyEmailResponseDto,
} from '../dto/verify-email.dto';
import { LoginDto, LoginResponseDto } from '../dto/login.dto';
import {
  RefreshTokenDto,
  RefreshTokenResponseDto,
} from '../dto/refresh-token.dto';
import { mapIdentityError } from '../identity-error.mapper';

/**
 * Interface layer: HTTP concerns only (DTO validation via global
 * ValidationPipe, translating use-case results/errors to the response
 * envelope). No business logic lives here (Constitution §6).
 */
@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly verifyEmail: VerifyEmailUseCase,
    private readonly login: LoginUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // FR-ID-001: 5 req/min/IP
  @ApiOperation({
    summary: 'Register with email + password (FR-ID-001)',
    description:
      'Always returns a generic response, whether or not the email is already registered (AC: no enumeration).',
  })
  @ApiResponse({ status: 200, type: RegisterResponseDto })
  async registerHandler(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
  ): Promise<RegisterResponseDto> {
    try {
      return await this.registerUser.execute({
        email: dto.email,
        password: dto.password,
        ipAddress: ip,
      });
    } catch (error) {
      throw mapIdentityError(error);
    }
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email via token from the stub email (FR-ID-001)',
  })
  @ApiResponse({ status: 200, type: VerifyEmailResponseDto })
  async verifyEmailHandler(
    @Body() dto: VerifyEmailDto,
    @Ip() ip: string,
  ): Promise<VerifyEmailResponseDto> {
    try {
      return await this.verifyEmail.execute({
        token: dto.token,
        ipAddress: ip,
      });
    } catch (error) {
      throw mapIdentityError(error);
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // FR-ID-001 / BR-ID-03: 5 req/min/IP
  @ApiOperation({
    summary: 'Email/password login (FR-ID-001)',
    description:
      'MFA branch (FR-ID-004) is deferred for this slice — see LoginUseCase TODO. Always returns access+refresh tokens on success.',
  })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  async loginHandler(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Ip() ip: string,
  ): Promise<LoginResponseDto> {
    try {
      return await this.login.execute({
        email: dto.email,
        password: dto.password,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] ?? null,
        deviceLabel: null,
      });
    } catch (error) {
      throw mapIdentityError(error);
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token (FR-ID-005)',
    description:
      'Reuse of an already-rotated-out refresh token revokes the whole session family (BR-ID-02 theft detection).',
  })
  @ApiResponse({ status: 200, type: RefreshTokenResponseDto })
  async refreshHandler(
    @Body() dto: RefreshTokenDto,
    @Ip() ip: string,
  ): Promise<RefreshTokenResponseDto> {
    try {
      return await this.refreshToken.execute({
        refreshToken: dto.refreshToken,
        ipAddress: ip,
      });
    } catch (error) {
      throw mapIdentityError(error);
    }
  }
}
