import { PrismaClient } from '../../generated/prisma/client/index.js';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = process.env['DATABASE_URL']?.replace('/movie_app', '/movie_app_test');

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });

export const testPrisma = new PrismaClient({ adapter });

export async function cleanDatabase(): Promise<void> {
  // Delete in order respecting foreign key constraints
  await testPrisma.movieReview.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.movie.deleteMany();
}
