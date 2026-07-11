import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { VendorRepository } from '../../domain/repositories/vendor.repository';
import { Vendor, type VendorProps } from '../../domain/entities/vendor.entity';
import type { Vendor as PrismaVendor } from '@prisma/client';

@Injectable()
export class PrismaVendorRepository implements VendorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Vendor | null> {
    const row = await this.prisma.vendor.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByOwnerUserId(ownerUserId: string): Promise<Vendor | null> {
    const row = await this.prisma.vendor.findFirst({
      where: { ownerUserId, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(vendor: Vendor): Promise<void> {
    const props = vendor.snapshot;
    await this.prisma.vendor.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        ownerUserId: props.ownerUserId,
        businessName: props.businessName,
        description: props.description,
        logoUrl: props.logoUrl,
        bannerUrl: props.bannerUrl,
        status: props.status,
        commissionRateBps: props.commissionRateBps,
        verifiedAt: props.verifiedAt,
        rejectedReason: props.rejectedReason,
        version: props.version,
      },
      update: {
        businessName: props.businessName,
        description: props.description,
        logoUrl: props.logoUrl,
        bannerUrl: props.bannerUrl,
        status: props.status,
        commissionRateBps: props.commissionRateBps,
        verifiedAt: props.verifiedAt,
        rejectedReason: props.rejectedReason,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaVendor): Vendor {
    const props: VendorProps = {
      id: row.id,
      ownerUserId: row.ownerUserId,
      businessName: row.businessName,
      description: row.description,
      logoUrl: row.logoUrl,
      bannerUrl: row.bannerUrl,
      status: row.status,
      commissionRateBps: row.commissionRateBps,
      verifiedAt: row.verifiedAt,
      rejectedReason: row.rejectedReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Vendor.reconstitute(props);
  }
}
