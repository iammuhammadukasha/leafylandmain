// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `users` (Volume 04 §2) in terms the
// domain cares about, not the DB's terms.

export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface UserProps {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
  phone: string | null;
  passwordHash: string | null;
  status: UserStatus;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class User {
  private constructor(private props: UserProps) {}

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  /** Factory for a brand-new registration. Caller supplies a pre-generated
   * id (UUID) and pre-hashed password — hashing is an infrastructure
   * concern (argon2 adapter), never done inside the domain entity. */
  static register(params: {
    id: string;
    email: string;
    passwordHash: string;
    now: Date;
  }): User {
    return new User({
      id: params.id,
      email: params.email.toLowerCase(),
      emailVerifiedAt: null,
      phone: null,
      passwordHash: params.passwordHash,
      status: 'active',
      mfaEnabled: false,
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string | null {
    return this.props.passwordHash;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get mfaEnabled(): boolean {
    return this.props.mfaEnabled;
  }

  get isEmailVerified(): boolean {
    return this.props.emailVerifiedAt !== null;
  }

  get version(): number {
    return this.props.version;
  }

  get snapshot(): Readonly<UserProps> {
    return { ...this.props };
  }

  markEmailVerified(now: Date): void {
    if (this.props.emailVerifiedAt !== null) {
      return; // idempotent — verifying twice is a no-op, not an error
    }
    this.props.emailVerifiedAt = now;
    this.props.updatedAt = now;
  }

  isActive(): boolean {
    return this.props.status === 'active' && this.props.deletedAt === null;
  }
}
