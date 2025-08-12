/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Upsert demo users (no API keys created here)
  const demoUsers = [
    { entraId: 'mock-dev-user', email: 'dev@example.com' },
    { entraId: 'mock-admin', email: 'admin@example.com' },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { entraId: u.entraId },
      update: { email: u.email, isActive: true },
      create: { entraId: u.entraId, email: u.email, isActive: true },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
