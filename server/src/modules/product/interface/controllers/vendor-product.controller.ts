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
import { GetMyProductsUseCase } from '../../application/use-cases/get-my-products.use-case';
import { RegisterProductUseCase } from '../../application/use-cases/register-product.use-case';
import { UpdateMyProductUseCase } from '../../application/use-cases/update-my-product.use-case';
import { PublishProductUseCase } from '../../application/use-cases/publish-product.use-case';
import { DelistProductUseCase } from '../../application/use-cases/delist-product.use-case';
import { CreateProductVariantUseCase } from '../../application/use-cases/create-product-variant.use-case';
import { UpdateProductVariantUseCase } from '../../application/use-cases/update-product-variant.use-case';
import type { ProductProps } from '../../domain/entities/product.entity';
import type { ProductVariantProps } from '../../domain/entities/product-variant.entity';
import {
  CreateProductDto,
  CreateProductVariantDto,
  ProductResponseDto,
  ProductVariantResponseDto,
  UpdateProductDto,
  UpdateProductVariantDto,
} from '../dto/product.dto';
import { mapProductError } from '../product-error.mapper';

/**
 * Vendor-side product management (FR-VND-005, API Spec §5.4). Interface
 * layer: HTTP concerns only, no business logic (Constitution §6) — mirrors
 * VendorController's shape exactly (JwtAuthGuard at controller level since
 * every route here requires a caller with a vendor account; the
 * vendor-ownership check itself happens inside each use case via
 * VendorLookupRepository, same "structural scoping, not a route guard"
 * precedent as GetMyVendorUseCase).
 */
@ApiTags('vendor-products')
@ApiBearerAuth()
@Controller('api/v1/vendors/me/products')
@UseGuards(JwtAuthGuard)
export class VendorProductController {
  constructor(
    private readonly getMyProducts: GetMyProductsUseCase,
    private readonly registerProduct: RegisterProductUseCase,
    private readonly updateMyProduct: UpdateMyProductUseCase,
    private readonly publishProduct: PublishProductUseCase,
    private readonly delistProduct: DelistProductUseCase,
    private readonly createVariant: CreateProductVariantUseCase,
    private readonly updateVariant: UpdateProductVariantUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the caller's own products (FR-VND-005)" })
  @ApiResponse({ status: 200, type: [ProductResponseDto] })
  async listHandler(
    @CurrentUser() user: AccessTokenClaims,
  ): Promise<ProductResponseDto[]> {
    try {
      const results = await this.getMyProducts.execute({ userId: user.sub });
      return results.map((product) => this.toProductResponseDto(product));
    } catch (error) {
      throw mapProductError(error);
    }
  }

  @Post()
  @ApiOperation({
    summary: 'Create a draft product (FR-VND-005, FR-PRD-002)',
    description:
      'BR-PRD-01: isOrganicClaim=true requires organicCertDocumentId referencing an approved organic_certificate document owned by the caller vendor, else 422 ORGANIC_CLAIM_UNVERIFIED.',
  })
  @ApiResponse({ status: 201, type: ProductResponseDto })
  async createHandler(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ProductResponseDto> {
    try {
      const result = await this.registerProduct.execute({
        userId: user.sub,
        categoryId: dto.categoryId,
        brandId: dto.brandId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        isOrganicClaim: dto.isOrganicClaim,
        organicCertDocumentId: dto.organicCertDocumentId ?? null,
        ipAddress: ip,
      });
      return this.toProductResponseDto(result);
    } catch (error) {
      throw mapProductError(error);
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product (FR-VND-005, ownership-scoped)' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  async updateHandler(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ProductResponseDto> {
    try {
      const result = await this.updateMyProduct.execute({
        userId: user.sub,
        productId: id,
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        ipAddress: ip,
      });
      return this.toProductResponseDto(result);
    } catch (error) {
      throw mapProductError(error);
    }
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'draft -> active (FR-VND-005)',
    description:
      'Requires the owning vendor to be verified, else 422 VENDOR_NOT_VERIFIED.',
  })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  async publishHandler(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ProductResponseDto> {
    try {
      const result = await this.publishProduct.execute({
        userId: user.sub,
        productId: id,
        ipAddress: ip,
      });
      return this.toProductResponseDto(result);
    } catch (error) {
      throw mapProductError(error);
    }
  }

  @Post(':id/delist')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delist a product (FR-VND-005)' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  async delistHandler(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ProductResponseDto> {
    try {
      const result = await this.delistProduct.execute({
        userId: user.sub,
        productId: id,
        ipAddress: ip,
      });
      return this.toProductResponseDto(result);
    } catch (error) {
      throw mapProductError(error);
    }
  }

  @Post(':id/variants')
  @ApiOperation({
    summary: 'Create a variant (FR-VND-005)',
    description: 'SKU uniqueness enforced platform-wide, else 409 SKU_TAKEN.',
  })
  @ApiResponse({ status: 201, type: ProductVariantResponseDto })
  async createVariantHandler(
    @Param('id') id: string,
    @Body() dto: CreateProductVariantDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ProductVariantResponseDto> {
    try {
      const result = await this.createVariant.execute({
        userId: user.sub,
        productId: id,
        sku: dto.sku,
        attributes: dto.attributes ?? {},
        priceMinor: BigInt(dto.priceMinor),
        stockQuantity: dto.stockQuantity,
        lowStockThreshold: dto.lowStockThreshold,
        ipAddress: ip,
      });
      return this.toVariantResponseDto(result);
    } catch (error) {
      throw mapProductError(error);
    }
  }

  @Patch('variants/:variantId')
  @ApiOperation({
    summary: 'Update a variant, basic fields (FR-VND-005)',
  })
  @ApiResponse({ status: 200, type: ProductVariantResponseDto })
  async updateVariantHandler(
    @Param('variantId') variantId: string,
    @Body() dto: UpdateProductVariantDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<ProductVariantResponseDto> {
    try {
      const result = await this.updateVariant.execute({
        userId: user.sub,
        variantId,
        attributes: dto.attributes,
        priceMinor:
          dto.priceMinor !== undefined ? BigInt(dto.priceMinor) : undefined,
        stockQuantity: dto.stockQuantity,
        lowStockThreshold: dto.lowStockThreshold,
        ipAddress: ip,
      });
      return this.toVariantResponseDto(result);
    } catch (error) {
      throw mapProductError(error);
    }
  }

  private toProductResponseDto(product: ProductProps): ProductResponseDto {
    return {
      id: product.id,
      vendorId: product.vendorId,
      categoryId: product.categoryId,
      brandId: product.brandId,
      title: product.title,
      description: product.description,
      isOrganicClaim: product.isOrganicClaim,
      organicCertDocumentId: product.organicCertDocumentId,
      status: product.status,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private toVariantResponseDto(
    variant: ProductVariantProps,
  ): ProductVariantResponseDto {
    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      attributes: variant.attributes,
      priceMinor: variant.priceMinor.toString(),
      stockQuantity: variant.stockQuantity,
      lowStockThreshold: variant.lowStockThreshold,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
    };
  }
}
