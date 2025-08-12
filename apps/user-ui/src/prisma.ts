import { PrismaClient } from '@prisma/client';

// Singleton Prisma client for the user-ui app
export const prisma = new PrismaClient();
