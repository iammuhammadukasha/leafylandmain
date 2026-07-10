/**
 * Port for generating opaque refresh tokens and hashing them for storage
 * (only the hash is persisted, per BR-ID-02 — raw tokens are never
 * logged or stored).
 */
export interface RefreshTokenService {
  generate(): string;
  hash(rawToken: string): string;
}

export const REFRESH_TOKEN_SERVICE = Symbol('REFRESH_TOKEN_SERVICE');
