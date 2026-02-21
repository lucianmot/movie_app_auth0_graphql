import type { PrismaClient, Movie, Prisma } from '../generated/prisma/client/index.js';
import prisma from '../config/database.js';

export function createMovieRepository(db: PrismaClient = prisma) {
  return {
    async findById(id: number): Promise<Movie | null> {
      return db.movie.findUnique({ where: { id } });
    },

    async findMany(page: number = 1, pageSize: number = 20): Promise<Movie[]> {
      return db.movie.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { popularity: 'desc' },
      });
    },

    async upsert(id: number, data: Omit<Prisma.MovieCreateInput, 'id'>): Promise<Movie> {
      return db.movie.upsert({
        where: { id },
        create: { id, ...data },
        update: { ...data, syncedAt: new Date() },
      });
    },
  };
}

export const movieRepository = createMovieRepository();
