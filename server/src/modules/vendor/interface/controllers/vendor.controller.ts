import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import type { AccessTokenClaims } from '../../../identity/application/ports/access-token.port';
import { RegisterVendorUseCase } from '../../application/use-cases/register-vendor.use-case';
import { GetMyVendorUseCase } from '../../application/use-cases/get-my-vendor.use-case';
import { UpdateMyVendorUseCase } from '../../application/use-cases/update-my-vendor.use-case';
import { VerifyVendorUseCase } from '../../application/use-cases/verify-vendor.use-case';
import type { VendorProps } from '../../domain/entities/vendor.entity';
import {
  RegisterVendorDto,
  VendorResponseDto,
} from '../dto/register-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { VerifyVendorDto } from '../dto/verify-vendor.dto';
import { mapVendorError } from '../vendor-error.mapper';

/**
 * Interface layer: HTTP concerns only (DTO validation via global
 * ValidationPipe, translating use-case results/errors to the response
 * envelope). No business logic lives here (Constitution §6) — role
 * authorization for the verify endpoint is enforced inside
 * VerifyVendorUseCase (application layer), not here; JwtAuthGuard only
 * proves the caller holds a valid token, same division of labor as the
 * Identity/User modules.
 */
@ApiTags('vendors')
@ApiBearerAuth()
@Controller('api/v1/vendors')
@UseGuards(JwtAuthGuard)
export class VendorController {
  constructor(
    private readonly registerVendor: RegisterVendorUseCase,
    private readonly getMyVendor: GetMyVendorUseCase,
    private readonly updateMyVendor: UpdateMyVendorUseCase,
    private readonly verifyVendor: VerifyVendorUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a new vendor (FR-VND-001)' })
  @ApiResponse({ status: 201, type: VendorResponseDto })
  async registerHandler(
    @Body() dto: RegisterVendorDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<VendorResponseDto> {
    try {
      const result = await this.registerVendor.execute({
        ownerUserId: user.sub,
        businessName: dto.businessName,
        description: dto.description ?? null,
        ipAddress: ip,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapVendorError(error);
    }
  }

  @Get('me')
  @ApiOperation({
    summary: "Get the caller's own vendor (FR-ID-006 scoped)",
  })
  @ApiResponse({ status: 200, type: VendorResponseDto })
  async meHandler(
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<VendorResponseDto> {
    try {
      const result = await this.getMyVendor.execute({ userId: user.sub });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapVendorError(error);
    }
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update store profile fields (FR-VND-003)' })
  @ApiResponse({ status: 200, type: VendorResponseDto })
  async updateMeHandler(
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<VendorResponseDto> {
    try {
      const result = await this.updateMyVendor.execute({
        userId: user.sub,
        businessName: dto.businessName,
        description: dto.description,
        logoUrl: dto.logoUrl,
        bannerUrl: dto.bannerUrl,
        ipAddress: ip,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapVendorError(error);
    }
  }

  @Post(':vendorId/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin verification decision (FR-VND-002, admin only)',
    description:
      'Authorization (admin role) enforced in VerifyVendorUseCase via a DB role lookup, not a route guard — see UserRolesRepository doc comment.',
  })
  @ApiResponse({ status: 200, type: VendorResponseDto })
  async verifyHandler(
    @Param('vendorId') vendorId: string,
    @Body() dto: VerifyVendorDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<VendorResponseDto> {
    try {
      const result = await this.verifyVendor.execute({
        actorUserId: user.sub,
        vendorId,
        decision: dto.decision,
        reason: dto.reason,
        ipAddress: ip,
      });
      return this.toResponseDto(result);
    } catch (error) {
      throw mapVendorError(error);
    }
  }

  private toResponseDto(vendor: VendorProps): VendorResponseDto {
    return {
      id: vendor.id,
      ownerUserId: vendor.ownerUserId,
      businessName: vendor.businessName,
      description: vendor.description,
      logoUrl: vendor.logoUrl,
      bannerUrl: vendor.bannerUrl,
      status: vendor.status,
      commissionRateBps: vendor.commissionRateBps,
      verifiedAt: vendor.verifiedAt ? vendor.verifiedAt.toISOString() : null,
      rejectedReason: vendor.rejectedReason,
      createdAt: vendor.createdAt.toISOString(),
      updatedAt: vendor.updatedAt.toISOString(),
    };
  }
}
