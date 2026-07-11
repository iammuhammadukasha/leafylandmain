import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { VendorController } from './interface/controllers/vendor.controller';
import { RegisterVendorUseCase } from './application/use-cases/register-vendor.use-case';
import { GetMyVendorUseCase } from './application/use-cases/get-my-vendor.use-case';
import { UpdateMyVendorUseCase } from './application/use-cases/update-my-vendor.use-case';
import { VerifyVendorUseCase } from './application/use-cases/verify-vendor.use-case';
import { CreateVendorDocumentUseCase } from './application/use-cases/create-vendor-document.use-case';
import { GetMyVendorDocumentsUseCase } from './application/use-cases/get-my-vendor-documents.use-case';
import { ApproveVendorDocumentUseCase } from './application/use-cases/approve-vendor-document.use-case';
import { VENDOR_REPOSITORY } from './domain/repositories/vendor.repository';
import { PrismaVendorRepository } from './infrastructure/persistence/prisma-vendor.repository';
import { VENDOR_ROLE_GRANT_REPOSITORY } from './domain/repositories/vendor-role-grant.repository';
import { PrismaVendorRoleGrantRepository } from './infrastructure/persistence/prisma-vendor-role-grant.repository';
import { USER_ROLES_REPOSITORY } from './domain/repositories/user-roles.repository';
import { PrismaUserRolesRepository } from './infrastructure/persistence/prisma-user-roles.repository';
import { VENDOR_DOCUMENT_REPOSITORY } from './domain/repositories/vendor-document.repository';
import { PrismaVendorDocumentRepository } from './infrastructure/persistence/prisma-vendor-document.repository';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * Vendor bounded-context module (Architecture §3/§4). Imports IdentityModule
 * for two exported ports: ACCESS_TOKEN_SERVICE (needed by the shared
 * JwtAuthGuard, same pattern as UserModule) and AUDIT_LOGGER (Architecture
 * §7.1's shared AuditLogger service — IdentityModule's `exports` array was
 * widened to include it, additively, so Vendor's use cases can record
 * FR-VND-001/002 state-change audit events through the same audit_log
 * writer instead of standing up a duplicate one, per Constitution §6.7 "no
 * duplicated business logic"). Vendor never reaches into Identity's
 * internal repositories or entities directly.
 */
@Module({
  imports: [IdentityModule],
  controllers: [VendorController],
  providers: [
    RegisterVendorUseCase,
    GetMyVendorUseCase,
    UpdateMyVendorUseCase,
    VerifyVendorUseCase,
    CreateVendorDocumentUseCase,
    GetMyVendorDocumentsUseCase,
    ApproveVendorDocumentUseCase,
    JwtAuthGuard,
    { provide: VENDOR_REPOSITORY, useClass: PrismaVendorRepository },
    {
      provide: VENDOR_ROLE_GRANT_REPOSITORY,
      useClass: PrismaVendorRoleGrantRepository,
    },
    { provide: USER_ROLES_REPOSITORY, useClass: PrismaUserRolesRepository },
    {
      provide: VENDOR_DOCUMENT_REPOSITORY,
      useClass: PrismaVendorDocumentRepository,
    },
  ],
  exports: [
    VENDOR_REPOSITORY,
    VENDOR_DOCUMENT_REPOSITORY,
    USER_ROLES_REPOSITORY,
  ],
})
export class VendorModule {}
