import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { UserController } from './interface/controllers/user.controller';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { USER_PROFILE_REPOSITORY } from './domain/repositories/user-profile.repository';
import { PrismaUserProfileRepository } from './infrastructure/persistence/prisma-user-profile.repository';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

/**
 * User bounded-context module (Architecture §3). Imports IdentityModule
 * only for its exported ACCESS_TOKEN_SERVICE port (needed by the shared
 * JwtAuthGuard) — never reaches into Identity's internal repositories or
 * entities directly.
 */
@Module({
  imports: [IdentityModule],
  controllers: [UserController],
  providers: [
    GetProfileUseCase,
    JwtAuthGuard,
    { provide: USER_PROFILE_REPOSITORY, useClass: PrismaUserProfileRepository },
  ],
})
export class UserModule {}
