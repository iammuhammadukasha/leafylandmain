import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ACCESS_TOKEN_SERVICE,
  type AccessTokenClaims,
  type AccessTokenService,
} from '../../modules/identity/application/ports/access-token.port';
import { AppException } from '../errors/app.exception';
import { StandardErrorCode } from '../errors/error-codes';
import { HttpStatus } from '@nestjs/common';

export interface AuthenticatedRequest extends Request {
  user: AccessTokenClaims;
}

/**
 * Global-purpose JWT guard — validates `Authorization: Bearer <token>`
 * against the Identity module's AccessTokenService port and attaches
 * decoded claims to `request.user`. Any module can depend on this guard
 * (it lives in common/, not inside the identity module) without importing
 * across module internals — it only depends on the identity module's
 * exported port token, same as any other consumer of that public
 * interface (Architecture §3).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokens: AccessTokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw new AppException(
        StandardErrorCode.UNAUTHENTICATED,
        'Missing or invalid Authorization header.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = header.slice('Bearer '.length);
    const claims = this.accessTokens.verify(token);

    if (!claims) {
      throw new AppException(
        StandardErrorCode.UNAUTHENTICATED,
        'Access token is invalid or expired.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    request.user = claims;
    return true;
  }
}
