// Pure domain entity for `user_profiles` (Volume 04 §3). User context owns
// profile details; Identity context (referenced by userId) owns auth
// credentials (Architecture §3 bounded-context table).

export interface UserProfileProps {
  userId: string;
  email: string; // read from the Identity context's public data at query time
  fullName: string | null;
  avatarUrl: string | null;
  dateOfBirth: Date | null;
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
}

export class UserProfile {
  private constructor(private readonly props: UserProfileProps) {}

  static reconstitute(props: UserProfileProps): UserProfile {
    return new UserProfile(props);
  }

  get snapshot(): Readonly<UserProfileProps> {
    return { ...this.props };
  }
}
