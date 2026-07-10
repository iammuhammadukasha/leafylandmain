import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { UserRepository } from '../../domain/repositories/user.repository';
import { User, type UserProps } from '../../domain/entities/user.entity';
import type { User as PrismaUser } from '@prisma/client';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    const props = user.snapshot;
    await this.prisma.user.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        email: props.email,
        emailVerifiedAt: props.emailVerifiedAt,
        phone: props.phone,
        passwordHash: props.passwordHash,
        status: props.status,
        mfaEnabled: props.mfaEnabled,
        version: props.version,
      },
      update: {
        emailVerifiedAt: props.emailVerifiedAt,
        phone: props.phone,
        passwordHash: props.passwordHash,
        status: props.status,
        mfaEnabled: props.mfaEnabled,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaUser): User {
    const props: UserProps = {
      id: row.id,
      email: row.email,
      emailVerifiedAt: row.emailVerifiedAt,
      phone: row.phone,
      passwordHash: row.passwordHash,
      status: row.status,
      mfaEnabled: row.mfaEnabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return User.reconstitute(props);
  }
}
