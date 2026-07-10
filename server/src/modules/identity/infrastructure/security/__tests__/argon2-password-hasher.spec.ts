import { Argon2PasswordHasher } from '../argon2-password-hasher';

describe('Argon2PasswordHasher (Constitution §9: argon2id)', () => {
  const hasher = new Argon2PasswordHasher();

  it('produces an argon2id-tagged hash, never the plaintext', async () => {
    const hash = await hasher.hash('correct-horse-battery-staple');
    expect(hash).not.toBe('correct-horse-battery-staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies a correct password against its own hash', async () => {
    const hash = await hasher.hash('correct-horse-battery-staple');
    await expect(
      hasher.verify(hash, 'correct-horse-battery-staple'),
    ).resolves.toBe(true);
  });

  it('rejects an incorrect password against an existing hash', async () => {
    const hash = await hasher.hash('correct-horse-battery-staple');
    await expect(hasher.verify(hash, 'wrong-password')).resolves.toBe(false);
  });
}, 20_000);
