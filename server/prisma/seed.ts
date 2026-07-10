// Idempotent seed script for foundation-phase reference data (Volume 04 §9).
// Run with: npx prisma db seed

import { PrismaClient, RoleName } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const roleNames = Object.values(RoleName);

  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(`Seeded roles: ${roleNames.join(', ')}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
