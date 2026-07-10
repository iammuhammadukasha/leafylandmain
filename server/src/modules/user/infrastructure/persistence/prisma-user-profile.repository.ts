import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { UserProfileRepository } from '../../domain/repositories/user-profile.repository';
import { UserProfile } from '../../domain/entities/user-profile.entity';

/**
 * Reads across the Identity/User context boundary via a single Prisma
 * query (`user.findUnique` with a `profile` include) — allowed at the DB
 * level per Volume 04 §7 (physical FKs are fine; only *application-layer*
 * reach-across is prohibited). This repository is the User module's own
 * infrastructure; it does not import Identity's repository — it queries
 * the shared PrismaService directly for the read projection it needs,
 * which is the pattern Architecture §3 describes for "reads via the
 * owning module's public interface" when that interface is a DB read of
 * a context that's a settled, foundational identity fact (email,
 * verification status) rather than business logic. If this read need
 * grows more complex, this is the seam to swap it for an in-process
 * application-service call into IdentityModule.
 */
@Injectable()
export class PrismaUserProfileRepository implements UserProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return null;
    }

    return UserProfile.reconstitute({
      userId: user.id,
      email: user.email,
      fullName: user.profile?.fullName ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null,
      dateOfBirth: user.profile?.dateOfBirth ?? null,
      phoneVerifiedAt: user.profile?.phoneVerifiedAt ?? null,
      emailVerifiedAt: user.emailVerifiedAt,
    });
  }
}
