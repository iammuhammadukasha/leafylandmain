import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global module so every feature module can inject PrismaService without
 * re-importing it — the Prisma connection itself isn't a bounded-context
 * concern, unlike the repositories built on top of it (those live inside
 * each module's infrastructure/ layer and are NOT exported globally).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
