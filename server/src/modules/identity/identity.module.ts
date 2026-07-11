import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './interface/controllers/auth.controller';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { SESSION_REPOSITORY } from './domain/repositories/session.repository';
import { AUTH_IDENTITY_REPOSITORY } from './domain/repositories/auth-identity.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { PrismaSessionRepository } from './infrastructure/persistence/prisma-session.repository';
import { PrismaAuthIdentityRepository } from './infrastructure/persistence/prisma-auth-identity.repository';
import { PrismaAuditLogger } from './infrastructure/persistence/prisma-audit-logger';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { Argon2PasswordHasher } from './infrastructure/security/argon2-password-hasher';
import { ACCESS_TOKEN_SERVICE } from './application/ports/access-token.port';
import { JwtAccessTokenService } from './infrastructure/tokens/jwt-access-token.service';
import { REFRESH_TOKEN_SERVICE } from './application/ports/refresh-token.port';
import { CryptoRefreshTokenService } from './infrastructure/tokens/crypto-refresh-token.service';
import { EMAIL_VERIFICATION_TOKEN_SERVICE } from './application/ports/email-verification-token.port';
import { JwtEmailVerificationTokenService } from './infrastructure/tokens/jwt-email-verification-token.service';
import { EMAIL_SENDER } from './application/ports/email-sender.port';
import { ConsoleEmailSender } from './infrastructure/email/console-email-sender';
import { AUDIT_LOGGER } from './application/ports/audit-logger.port';

/**
 * Identity bounded-context module (Architecture §3/§4). Public exports are
 * deliberately limited to what other modules legitimately need: the
 * ACCESS_TOKEN_SERVICE port (so the shared JwtAuthGuard can verify tokens),
 * USER_REPOSITORY (so the User module's GetProfile use case can read user
 * existence/status without duplicating persistence logic), and AUDIT_LOGGER
 * (Architecture §7.1: "a shared AuditLogger service injected into
 * application-layer use cases" — Vendor module reuses this same binding for
 * FR-VND-001/002 state-change audit events rather than standing up a
 * duplicate audit_log writer, per Constitution §6.7 "no duplicated business
 * logic") — nothing else crosses the boundary, per Constitution §6 ("public
 * module APIs are explicit; nothing is reached into via deep imports").
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    VerifyEmailUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    {
      provide: AUTH_IDENTITY_REPOSITORY,
      useClass: PrismaAuthIdentityRepository,
    },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: ACCESS_TOKEN_SERVICE, useClass: JwtAccessTokenService },
    { provide: REFRESH_TOKEN_SERVICE, useClass: CryptoRefreshTokenService },
    {
      provide: EMAIL_VERIFICATION_TOKEN_SERVICE,
      useClass: JwtEmailVerificationTokenService,
    },
    { provide: EMAIL_SENDER, useClass: ConsoleEmailSender },
    { provide: AUDIT_LOGGER, useClass: PrismaAuditLogger },
  ],
  exports: [ACCESS_TOKEN_SERVICE, USER_REPOSITORY, AUDIT_LOGGER],
})
export class IdentityModule {}
