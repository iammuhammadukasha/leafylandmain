import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { UserRolesRepository } from '../../domain/repositories/user-roles.repository';
import type { RoleName } from '@prisma/client';

/**
 * Read-only lookup over the Identity-context `user_roles`/`roles` tables
 * (Volume 04 §2), scoped to the one query Vendor's use cases need: "does
 * this user hold this role (optionally scoped to a vendor)?" See the port's
 * doc comment (domain/repositories/user-roles.repository.ts) for why this
 * lives in Vendor's own infrastructure layer rather than importing an
 * Identity repository.
 */
@Injectable()
export class PrismaUserRolesRepository implements UserRolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasRole(
    userId: string,
    roleName: string,
    vendorId?: string,
  ): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: {
        userId,
        role: { name: roleName as RoleName },
        OR: [{ vendorId: null }, ...(vendorId ? [{ vendorId }] : [])],
      },
    });
    return count > 0;
  }
}
