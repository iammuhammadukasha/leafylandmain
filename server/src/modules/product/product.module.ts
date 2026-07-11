import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { VendorModule } from '../vendor/vendor.module';
import { CatalogController } from './interface/controllers/catalog.controller';
import { VendorProductController } from './interface/controllers/vendor-product.controller';

import { GetCategoriesUseCase } from './application/use-cases/get-categories.use-case';
import { CreateCategoryUseCase } from './application/use-cases/create-category.use-case';
import { GetProductsUseCase } from './application/use-cases/get-products.use-case';
import { GetProductUseCase } from './application/use-cases/get-product.use-case';
import { GetProductVariantsUseCase } from './application/use-cases/get-product-variants.use-case';
import { GetMyProductsUseCase } from './application/use-cases/get-my-products.use-case';
import { RegisterProductUseCase } from './application/use-cases/register-product.use-case';
import { UpdateMyProductUseCase } from './application/use-cases/update-my-product.use-case';
import { PublishProductUseCase } from './application/use-cases/publish-product.use-case';
import { DelistProductUseCase } from './application/use-cases/delist-product.use-case';
import { CreateProductVariantUseCase } from './application/use-cases/create-product-variant.use-case';
import { UpdateProductVariantUseCase } from './application/use-cases/update-product-variant.use-case';

import { CATEGORY_REPOSITORY } from './domain/repositories/category.repository';
import { PrismaCategoryRepository } from './infrastructure/persistence/prisma-category.repository';
import { PRODUCT_REPOSITORY } from './domain/repositories/product.repository';
import { PrismaProductRepository } from './infrastructure/persistence/prisma-product.repository';
import { PRODUCT_VARIANT_REPOSITORY } from './domain/repositories/product-variant.repository';
import { PrismaProductVariantRepository } from './infrastructure/persistence/prisma-product-variant.repository';
import { VENDOR_LOOKUP_REPOSITORY } from './domain/repositories/vendor-lookup.repository';
import { PrismaVendorLookupRepository } from './infrastructure/persistence/prisma-vendor-lookup.repository';
import { VENDOR_DOCUMENT_LOOKUP_REPOSITORY } from './domain/repositories/vendor-document-lookup.repository';
import { PrismaVendorDocumentLookupRepository } from './infrastructure/persistence/prisma-vendor-document-lookup.repository';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Product Marketplace bounded-context module (Architecture §3/§4,
 * Volume 02 §5, Volume 04 §5). Imports IdentityModule (ACCESS_TOKEN_SERVICE
 * for JwtAuthGuard, AUDIT_LOGGER — same pattern as VendorModule) and
 * VendorModule (its exported USER_ROLES_REPOSITORY for admin-role checks
 * on category writes, reusing the exact same port Vendor's own use cases
 * use — no duplicated authorization mechanism, per Constitution §11.6).
 * Product never reaches into Vendor's internal domain entities/use cases —
 * only its exported repository ports, and even those are re-read through
 * Product's OWN narrow VendorLookupRepository/VendorDocumentLookupRepository
 * ports (backed by Prisma reads over the same physical `vendors` /
 * `vendor_documents` tables — Volume 04 §7's cross-context reference rule:
 * FKs are allowed at the DB level, but every read crosses through an
 * owning-module-shaped port, never an ad hoc join).
 */
@Module({
  imports: [IdentityModule, VendorModule],
  controllers: [CatalogController, VendorProductController],
  providers: [
    GetCategoriesUseCase,
    CreateCategoryUseCase,
    GetProductsUseCase,
    GetProductUseCase,
    GetProductVariantsUseCase,
    GetMyProductsUseCase,
    RegisterProductUseCase,
    UpdateMyProductUseCase,
    PublishProductUseCase,
    DelistProductUseCase,
    CreateProductVariantUseCase,
    UpdateProductVariantUseCase,
    JwtAuthGuard,
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
    {
      provide: PRODUCT_VARIANT_REPOSITORY,
      useClass: PrismaProductVariantRepository,
    },
    {
      provide: VENDOR_LOOKUP_REPOSITORY,
      useClass: PrismaVendorLookupRepository,
    },
    {
      provide: VENDOR_DOCUMENT_LOOKUP_REPOSITORY,
      useClass: PrismaVendorDocumentLookupRepository,
    },
  ],
})
export class ProductModule {}
