/**
 * Parses a simple duration string ("15m", "30d", "24h", "45s") into
 * seconds. Used to bridge config values (kept as human-readable strings in
 * .env, per Constitution §4.8 — no hardcoded values in code) into the
 * numeric `expiresIn` (seconds) that `@nestjs/jwt`'s typed `sign()`
 * overload accepts without fighting its `StringValue` template-literal
 * type.
 */
export function parseDurationToSeconds(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match) {
    throw new Error(
      `Invalid duration "${input}" — expected formats like "15m", "24h", "30d".`,
    );
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
  };
  return value * multiplier[unit];
}
