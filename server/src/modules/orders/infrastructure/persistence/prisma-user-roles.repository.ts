import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { OrdersUserRolesRepository } from '../../domain/repositories/user-roles.repository';

/**
 * Read-only lookup over the Identity-context `user_roles`/`roles` tables
 * (Volume 04 §2), scoped to the one query Orders' returns use cases need:
 * "does this user hold the global `admin` role?" See the port's doc comment
 * (domain/repositories/user-roles.repository.ts) for why this lives in
 * Orders' own infrastructure layer rather than importing Vendor's
 * PrismaUserRolesRepository directly — exact mirror of that class, scoped
 * down to the one role this module checks.
 */
@Injectable()
export class PrismaOrdersUserRolesRepository implements OrdersUserRolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasAdminRole(userId: string): Promise<boolean> {
    const count = await this.prisma.userRole.count({
      where: {
        userId,
        role: { name: 'admin' },
        vendorId: null,
      },
    });
    return count > 0;
  }
}
