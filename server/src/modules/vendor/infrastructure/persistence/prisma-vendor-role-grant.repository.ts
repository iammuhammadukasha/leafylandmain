import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { VendorRoleGrantRepository } from '../../domain/repositories/vendor-role-grant.repository';

/**
 * Writes the `vendor_owner` role grant row on vendor registration
 * (FR-VND-001). `roles` is seed data (Volume 04 §2) — this assumes a
 * `vendor_owner` Role row already exists (seeded via prisma/seed.ts,
 * consistent with the "roles... seed data" comment on the Role model in
 * schema.prisma) and throws loudly if it's missing rather than silently
 * creating one, since role definitions are not this module's data to own.
 */
@Injectable()
export class PrismaVendorRoleGrantRepository implements VendorRoleGrantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async grantVendorOwner(userId: string, vendorId: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { name: 'vendor_owner' },
    });
    if (!role) {
      throw new Error(
        'vendor_owner role is not seeded — run the roles seed script.',
      );
    }

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId_vendorId: {
          userId,
          roleId: role.id,
          vendorId,
        },
      },
      create: {
        userId,
        roleId: role.id,
        vendorId,
      },
      update: {},
    });
  }
}
