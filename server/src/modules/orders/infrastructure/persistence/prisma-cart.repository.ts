import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { CartRepository } from '../../domain/repositories/cart.repository';
import { Cart, type CartProps } from '../../domain/entities/cart.entity';
import type {
  Cart as PrismaCart,
  CartLine as PrismaCartLine,
} from '@prisma/client';

type CartWithLines = PrismaCart & { lines: PrismaCartLine[] };

@Injectable()
export class PrismaCartRepository implements CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Cart | null> {
    const row = await this.prisma.cart.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row && !row.deletedAt ? this.toDomain(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<Cart | null> {
    const row = await this.prisma.cart.findFirst({
      where: { userId, status: 'active', deletedAt: null },
      include: { lines: true },
    });
    return row ? this.toDomain(row) : null;
  }

  /**
   * Upserts the cart row and reconciles cart_lines to match the entity's
   * in-memory line list exactly (delete-then-recreate is simplest and
   * correct here — cart_lines carries no independent identity/history
   * worth preserving across a save, per Volume 04 §6 "no soft delete").
   * Wrapped in a transaction so the cart row and its lines never end up
   * out of sync if one write fails.
   */
  async save(cart: Cart): Promise<void> {
    const props = cart.snapshot;
    await this.prisma.$transaction(async (tx) => {
      await tx.cart.upsert({
        where: { id: props.id },
        create: {
          id: props.id,
          userId: props.userId,
          status: props.status,
          version: props.version,
        },
        update: {
          status: props.status,
          version: { increment: 1 },
        },
      });

      await tx.cartLine.deleteMany({ where: { cartId: props.id } });
      if (props.lines.length > 0) {
        await tx.cartLine.createMany({
          data: props.lines.map((line) => ({
            id: line.id,
            cartId: props.id,
            productVariantId: line.productVariantId,
            quantity: line.quantity,
          })),
        });
      }
    });
  }

  private toDomain(row: CartWithLines): Cart {
    const props: CartProps = {
      id: row.id,
      userId: row.userId,
      status: row.status,
      lines: row.lines.map((line) => ({
        id: line.id,
        productVariantId: line.productVariantId,
        quantity: line.quantity,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      version: row.version,
    };
    return Cart.reconstitute(props);
  }
}
