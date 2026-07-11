import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Query,
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
import { GetCategoriesUseCase } from '../../application/use-cases/get-categories.use-case';
import { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case';
import { GetProductsUseCase } from '../../application/use-cases/get-products.use-case';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case';
import { GetProductVariantsUseCase } from '../../application/use-cases/get-product-variants.use-case';
import type { CategoryProps } from '../../domain/entities/category.entity';
import type { ProductProps } from '../../domain/entities/product.entity';
import type { ProductVariantProps } from '../../domain/entities/product-variant.entity';
import { CategoryResponseDto, CreateCategoryDto } from '../dto/category.dto';
import {
  ProductResponseDto,
  ProductVariantResponseDto,
} from '../dto/product.dto';
import { mapProductError } from '../product-error.mapper';

/**
 * Public catalog reads (FR-PRD-001/002/005 scope-reduced) plus admin
 * category writes. Interface layer: HTTP concerns only, no business logic
 * (Constitution §6) — mirrors VendorController's shape. `@UseGuards` is
 * intentionally NOT applied at the controller level here (unlike
 * VendorController) since most routes are Public; the one admin-only route
 * (POST /categories) uses JwtAuthGuard explicitly plus an application-layer
 * DB role check (CreateCategoryUseCase), same division of labor as
 * VerifyVendorUseCase.
 */
@ApiTags('catalog')
@Controller('api/v1/catalog')
export class CatalogController {
  constructor(
    private readonly getCategories: GetCategoriesUseCase,
    private readonly createCategory: CreateCategoryUseCase,
    private readonly getProducts: GetProductsUseCase,
    private readonly getProduct: GetProductUseCase,
    private readonly getProductVariants: GetProductVariantsUseCase,
  ) {}

  @Get('categories')
  @ApiOperation({ summary: 'List all categories (FR-PRD-001, public)' })
  @ApiResponse({ status: 200, type: [CategoryResponseDto] })
  async listCategoriesHandler(): Promise<CategoryResponseDto[]> {
    const results = await this.getCategories.execute();
    return results.map((category) => this.toCategoryResponseDto(category));
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a category (FR-PRD-001, admin only)',
    description:
      'Authorization (admin role) enforced in CreateCategoryUseCase via a DB role lookup, not a route guard — see UserRolesRepository doc comment.',
  })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  async createCategoryHandler(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: AccessTokenClaims,
    @Ip() ip: string,
  ): Promise<CategoryResponseDto> {
    try {
      const result = await this.createCategory.execute({
        actorUserId: user.sub,
        parentId: dto.parentId ?? null,
        name: dto.name,
        slug: dto.slug,
        taxRateBps: dto.taxRateBps,
        ipAddress: ip,
      });
      return this.toCategoryResponseDto(result);
    } catch (error) {
      throw mapProductError(error);
    }
  }

  @Get('products')
  @ApiOperation({
    summary:
      'List active products, cursor-paginated (FR-PRD-005 scope-reduced, public)',
    description:
      'No OpenSearch/full-text search or faceted filtering in this slice — deferred.',
  })
  @ApiResponse({ status: 200, type: [ProductResponseDto] })
  async listProductsHandler(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<{
    __envelope: true;
    data: ProductResponseDto[];
    meta: { nextCursor: string | null; count: number };
  }> {
    const parsedLimit = limit
      ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100)
      : 20;
    const result = await this.getProducts.execute({
      cursor: cursor ?? null,
      limit: parsedLimit,
    });
    const items = result.items.map((product) =>
      this.toProductResponseDto(product),
    );
    return {
      __envelope: true,
      data: items,
      meta: { nextCursor: result.nextCursor, count: items.length },
    };
  }

  @Get('products/:id')
  @ApiOperation({
    summary:
      'Get an active product by id (FR-PRD-002, public — draft/delisted 404 to non-owners)',
  })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  async getProductHandler(
    @Param('id') id: string,
  ): Promise<ProductResponseDto> {
    try {
      const result = await this.getProduct.execute({ productId: id });
      return this.toProductResponseDto(result);
    } catch (error) {
      throw mapProductError(error);
    }
  }

  @Get('products/:id/variants')
  @ApiOperation({
    summary: 'List variants of an active product (FR-PRD-002, public)',
  })
  @ApiResponse({ status: 200, type: [ProductVariantResponseDto] })
  async getProductVariantsHandler(
    @Param('id') id: string,
  ): Promise<ProductVariantResponseDto[]> {
    try {
      const results = await this.getProductVariants.execute({
        productId: id,
      });
      return results.map((variant) => this.toVariantResponseDto(variant));
    } catch (error) {
      throw mapProductError(error);
    }
  }

  private toCategoryResponseDto(category: CategoryProps): CategoryResponseDto {
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      taxRateBps: category.taxRateBps,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
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
