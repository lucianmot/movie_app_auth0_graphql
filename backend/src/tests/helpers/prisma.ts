import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env['DATABASE_URL']?.replace('/movie_app', '/movie_app_test');

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

export const testPrisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

export async function cleanDatabase(): Promise<void> {
  // Delete in order respecting foreign key constraints
  await testPrisma.movieReview.deleteMany();
  await testPrisma.user.deleteMany();
  await testPrisma.movie.deleteMany();
}
