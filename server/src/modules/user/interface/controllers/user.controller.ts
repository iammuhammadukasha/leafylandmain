import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AccessTokenClaims } from '../../../identity/application/ports/access-token.port';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case';
import { ProfileResponseDto } from '../dto/profile.dto';
import { AppException } from '../../../../common/errors/app.exception';
import { StandardErrorCode } from '../../../../common/errors/error-codes';
import { UserNotFoundError } from '../../../identity/domain/errors/identity.errors';

@ApiTags('users')
@ApiBearerAuth()
@Controller('api/v1/users/me')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly getProfile: GetProfileUseCase) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get the authenticated user profile (FR-USR-001)' })
  @ApiResponse({ status: 200, type: ProfileResponseDto })
  async profile(
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<ProfileResponseDto> {
    try {
      const result = await this.getProfile.execute({ userId: user.sub });
      return {
        userId: result.userId,
        email: result.email,
        fullName: result.fullName,
        avatarUrl: result.avatarUrl,
        dateOfBirth: result.dateOfBirth
          ? result.dateOfBirth.toISOString()
          : null,
        phoneVerifiedAt: result.phoneVerifiedAt
          ? result.phoneVerifiedAt.toISOString()
          : null,
        emailVerifiedAt: result.emailVerifiedAt
          ? result.emailVerifiedAt.toISOString()
          : null,
      };
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        throw new AppException(
          StandardErrorCode.NOT_FOUND,
          error.message,
          HttpStatus.NOT_FOUND,
        );
      }
      throw error;
    }
  }
}
