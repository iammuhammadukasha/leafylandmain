import type { UserProfile } from '../entities/user-profile.entity';

export interface UserProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
}

export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');
