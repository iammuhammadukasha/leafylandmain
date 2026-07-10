import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AuthIdentityRepository } from '../../domain/repositories/auth-identity.repository';
import {
  AuthIdentity,
  type AuthIdentityProps,
} from '../../domain/entities/auth-identity.entity';
import type { AuthIdentity as PrismaAuthIdentity } from '@prisma/client';

@Injectable()
export class PrismaAuthIdentityRepository implements AuthIdentityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(identity: AuthIdentity): Promise<void> {
    const props = identity.snapshot;
    await this.prisma.authIdentity.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        userId: props.userId,
        provider: props.provider,
        providerUserId: props.providerUserId,
      },
      update: {
        providerUserId: props.providerUserId,
      },
    });
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: string,
  ): Promise<AuthIdentity | null> {
    const row = await this.prisma.authIdentity.findFirst({
      where: { userId, provider: provider as PrismaAuthIdentity['provider'] },
    });
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: PrismaAuthIdentity): AuthIdentity {
    const props: AuthIdentityProps = {
      id: row.id,
      userId: row.userId,
      provider: row.provider,
      providerUserId: row.providerUserId,
      createdAt: row.createdAt,
    };
    return AuthIdentity.reconstitute(props);
  }
}
