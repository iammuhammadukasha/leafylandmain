// Pure domain entity for `auth_identities` (Volume 04 §2) — a linked login
// method on a user's single identity record (BR-ID-01).

export type AuthProviderType = 'password' | 'google' | 'otp';

export interface AuthIdentityProps {
  id: string;
  userId: string;
  provider: AuthProviderType;
  providerUserId: string | null;
  createdAt: Date;
}

export class AuthIdentity {
  private constructor(private readonly props: AuthIdentityProps) {}

  static reconstitute(props: AuthIdentityProps): AuthIdentity {
    return new AuthIdentity(props);
  }

  static createPasswordIdentity(params: {
    id: string;
    userId: string;
    now: Date;
  }): AuthIdentity {
    return new AuthIdentity({
      id: params.id,
      userId: params.userId,
      provider: 'password',
      providerUserId: null,
      createdAt: params.now,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get provider(): AuthProviderType {
    return this.props.provider;
  }

  get snapshot(): Readonly<AuthIdentityProps> {
    return { ...this.props };
  }
}
