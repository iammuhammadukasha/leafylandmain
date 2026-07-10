import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { PasswordHasher } from '../../application/ports/password-hasher.port';

/**
 * Constitution §9: passwords hashed with argon2id. `argon2` npm package
 * defaults to argon2id since v0.28 — pinned explicitly here regardless so
 * the choice isn't silently dependent on the library default.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, { type: argon2.argon2id });
  }

  async verify(hash: string, plainText: string): Promise<boolean> {
    return argon2.verify(hash, plainText);
  }
}
