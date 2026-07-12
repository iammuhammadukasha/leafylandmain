import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { ShipmentRepository } from '../../domain/repositories/shipment.repository';
import {
  Shipment,
  type ShipmentProps,
} from '../../domain/entities/shipment.entity';
import type { Shipment as PrismaShipment } from '@prisma/client';

@Injectable()
export class PrismaShipmentRepository implements ShipmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Shipment | null> {
    const row = await this.prisma.shipment.findUnique({ where: { id } });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async findByOrderIdAndVendorId(
    orderId: string,
    vendorId: string,
  ): Promise<Shipment | null> {
    const row = await this.prisma.shipment.findUnique({
      where: { orderId_vendorId: { orderId, vendorId } },
    });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async save(shipment: Shipment): Promise<void> {
    const props = shipment.snapshot;

    await this.prisma.shipment.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        orderId: props.orderId,
        vendorId: props.vendorId,
        carrier: props.carrier,
        trackingNumber: props.trackingNumber,
        status: props.status,
        version: props.version,
      },
      update: {
        carrier: props.carrier,
        trackingNumber: props.trackingNumber,
        status: props.status,
        version: { increment: 1 },
      },
    });
  }

  private toDomain(row: PrismaShipment): Shipment {
    const props: ShipmentProps = {
      id: row.id,
      orderId: row.orderId,
      vendorId: row.vendorId,
      carrier: row.carrier,
      trackingNumber: row.trackingNumber,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Shipment.reconstitute(props);
  }
}
