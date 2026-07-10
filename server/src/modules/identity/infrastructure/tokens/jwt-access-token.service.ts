import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type {
  AccessTokenClaims,
  AccessTokenService,
} from '../../application/ports/access-token.port';
import { parseDurationToSeconds } from '../../../../common/utils/parse-duration';

@Injectable()
export class JwtAccessTokenService implements AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  sign(claims: AccessTokenClaims): string {
    return this.jwt.sign(claims, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: parseDurationToSeconds(
        this.config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
      ),
    });
  }

  verify(token: string): AccessTokenClaims | null {
    try {
      return this.jwt.verify<AccessTokenClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      return null;
    }
  }
}
