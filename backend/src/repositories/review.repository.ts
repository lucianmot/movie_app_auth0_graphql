import type { PrismaClient, MovieReview, Prisma } from '@prisma/client';
import prisma from '../config/database.js';

export function createReviewRepository(db: PrismaClient = prisma) {
  return {
    async findById(id: string): Promise<MovieReview | null> {
      return db.movieReview.findUnique({ where: { id } });
    },

    async findByUserAndMovie(userId: string, movieId: number): Promise<MovieReview | null> {
      return db.movieReview.findUnique({
        where: { userId_movieId: { userId, movieId } },
      });
    },

    async findByMovie(
      movieId: number,
      page: number = 1,
      pageSize: number = 20,
    ): Promise<MovieReview[]> {
      return db.movieReview.findMany({
        where: { movieId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      });
    },

    async findByUser(
      userId: string,
      page: number = 1,
      pageSize: number = 20,
    ): Promise<MovieReview[]> {
      return db.movieReview.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { movie: true },
      });
    },

    async create(data: Prisma.MovieReviewUncheckedCreateInput): Promise<MovieReview> {
      return db.movieReview.create({ data });
    },

    async update(id: string, data: Prisma.MovieReviewUpdateInput): Promise<MovieReview> {
      return db.movieReview.update({ where: { id }, data });
    },

    async delete(id: string): Promise<MovieReview> {
      return db.movieReview.delete({ where: { id } });
    },

    async averageRating(movieId: number): Promise<number | null> {
      const result = await db.movieReview.aggregate({
        where: { movieId },
        _avg: { rating: true },
      });
      return result._avg.rating;
    },
  };
}

export const reviewRepository = createReviewRepository();
