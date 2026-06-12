import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { env } from '../../config/env.js';

export function createPrismaClient() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to create the Prisma client');
  }

  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({ adapter });
}
