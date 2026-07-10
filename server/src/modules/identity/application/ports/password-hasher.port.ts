/**
 * Port for password hashing (Constitution §9: argon2id). Implemented by
 * an infrastructure adapter; application/domain layers depend only on
 * this interface.
 */
export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(hash: string, plainText: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
