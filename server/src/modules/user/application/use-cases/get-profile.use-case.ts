import { Inject, Injectable } from '@nestjs/common';
import {
  USER_PROFILE_REPOSITORY,
  type UserProfileRepository,
} from '../../domain/repositories/user-profile.repository';
import { UserNotFoundError } from '../../../identity/domain/errors/identity.errors';
import type { UserProfileProps } from '../../domain/entities/user-profile.entity';

export interface GetProfileInput {
  userId: string;
}

export type GetProfileResult = UserProfileProps;

/**
 * FR-USR-001 — Profile management (read side only for this slice).
 *
 * DECISION: if a user has no `user_profiles` row yet (e.g. registered but
 * never filled in profile fields — this slice creates no profile row on
 * registration, since FR-ID-001 only specifies email+password), this use
 * case returns a profile shape with null optional fields rather than
 * 404ing, since the *account* exists and "no profile filled in yet" is a
 * valid, common state — not an error. 404 is reserved for a genuinely
 * nonexistent user id (e.g. deleted account, stale token).
 */
@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly profiles: UserProfileRepository,
  ) {}

  async execute(input: GetProfileInput): Promise<GetProfileResult> {
    const profile = await this.profiles.findByUserId(input.userId);
    if (!profile) {
      throw new UserNotFoundError();
    }
    return profile.snapshot;
  }
}
