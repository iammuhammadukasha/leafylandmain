// Pure domain entity for `sessions` (Volume 04 §2) — refresh-token session
// family with rotation/theft-detection semantics (FR-ID-005, BR-ID-02).

export interface SessionProps {
  id: string;
  userId: string;
  refreshTokenHash: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  familyId: string;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Session {
  private constructor(private props: SessionProps) {}

  static reconstitute(props: SessionProps): Session {
    return new Session(props);
  }

  static startNewFamily(params: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    familyId: string;
    deviceLabel: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    now: Date;
  }): Session {
    return new Session({
      id: params.id,
      userId: params.userId,
      refreshTokenHash: params.refreshTokenHash,
      deviceLabel: params.deviceLabel,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      familyId: params.familyId,
      revokedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  /** Continues an existing rotation chain (same familyId) as a new session
   * row representing the rotated refresh token. */
  static rotate(params: {
    id: string;
    previous: Session;
    refreshTokenHash: string;
    now: Date;
  }): Session {
    return new Session({
      id: params.id,
      userId: params.previous.userId,
      refreshTokenHash: params.refreshTokenHash,
      deviceLabel: params.previous.props.deviceLabel,
      ipAddress: params.previous.props.ipAddress,
      userAgent: params.previous.props.userAgent,
      familyId: params.previous.familyId,
      revokedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get refreshTokenHash(): string {
    return this.props.refreshTokenHash;
  }

  get familyId(): string {
    return this.props.familyId;
  }

  get isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  get snapshot(): Readonly<SessionProps> {
    return { ...this.props };
  }

  revoke(now: Date): void {
    if (this.props.revokedAt !== null) return;
    this.props.revokedAt = now;
    this.props.updatedAt = now;
  }
}
