import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { RefreshTokenService } from '../../application/ports/refresh-token.port';

/**
 * Opaque refresh tokens: 256 bits of randomness, base64url-encoded. Only
 * the SHA-256 hash is ever persisted (BR-ID-02 — raw tokens never
 * logged/stored), the raw value is returned to the client exactly once.
 */
@Injectable()
export class CryptoRefreshTokenService implements RefreshTokenService {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
