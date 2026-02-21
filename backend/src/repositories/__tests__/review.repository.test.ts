import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testPrisma, cleanDatabase } from '../../tests/helpers/prisma.js';
import { createUserRepository } from '../user.repository.js';
import { createMovieRepository } from '../movie.repository.js';
import { createReviewRepository } from '../review.repository.js';
import { createUserData, createMovieData, createReviewData } from '../../tests/helpers/fixtures.js';

const userRepo = createUserRepository(testPrisma);
const movieRepo = createMovieRepository(testPrisma);
const reviewRepo = createReviewRepository(testPrisma);

let userId: string;
const movieId = 550;

beforeAll(async () => {
  await cleanDatabase();
});

beforeEach(async () => {
  await cleanDatabase();

  // Create a user and movie for review tests
  const user = await userRepo.create(createUserData());
  userId = user.id;

  const { id: _id, ...movieData } = createMovieData(movieId);
  await movieRepo.upsert(movieId, movieData);
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('reviewRepository', () => {
  describe('create', () => {
    it('should create a review', async () => {
      const review = await reviewRepo.create(createReviewData(userId, movieId));

      expect(review.id).toBeDefined();
      expect(review.userId).toBe(userId);
      expect(review.movieId).toBe(movieId);
      expect(review.rating).toBe(8);
      expect(review.content).toBe('Great movie!');
    });

    it('should create a review without content', async () => {
      const review = await reviewRepo.create(createReviewData(userId, movieId, { content: null }));

      expect(review.content).toBeNull();
      expect(review.rating).toBe(8);
    });

    it('should reject duplicate review for same user and movie', async () => {
      await reviewRepo.create(createReviewData(userId, movieId));

      await expect(
        reviewRepo.create(createReviewData(userId, movieId, { rating: 5 })),
      ).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find a review by id', async () => {
      const created = await reviewRepo.create(createReviewData(userId, movieId));
      const found = await reviewRepo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });
  });

  describe('findByUserAndMovie', () => {
    it('should find a review by user and movie', async () => {
      await reviewRepo.create(createReviewData(userId, movieId));
      const found = await reviewRepo.findByUserAndMovie(userId, movieId);

      expect(found).not.toBeNull();
      expect(found!.userId).toBe(userId);
      expect(found!.movieId).toBe(movieId);
    });

    it('should return null when no review exists', async () => {
      const found = await reviewRepo.findByUserAndMovie(userId, 999999);
      expect(found).toBeNull();
    });
  });

  describe('findByMovie', () => {
    it('should return reviews for a movie with user info', async () => {
      await reviewRepo.create(createReviewData(userId, movieId));
      const reviews = await reviewRepo.findByMovie(movieId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]).toHaveProperty('user');
    });
  });

  describe('findByUser', () => {
    it('should return reviews by a user with movie info', async () => {
      await reviewRepo.create(createReviewData(userId, movieId));
      const reviews = await reviewRepo.findByUser(userId);

      expect(reviews).toHaveLength(1);
      expect(reviews[0]).toHaveProperty('movie');
    });
  });

  describe('update', () => {
    it('should update a review', async () => {
      const created = await reviewRepo.create(createReviewData(userId, movieId));
      const updated = await reviewRepo.update(created.id, {
        rating: 3,
        content: 'Changed my mind',
      });

      expect(updated.rating).toBe(3);
      expect(updated.content).toBe('Changed my mind');
    });
  });

  describe('delete', () => {
    it('should delete a review', async () => {
      const created = await reviewRepo.create(createReviewData(userId, movieId));
      await reviewRepo.delete(created.id);

      const found = await reviewRepo.findById(created.id);
      expect(found).toBeNull();
    });
  });

  describe('averageRating', () => {
    it('should calculate average rating for a movie', async () => {
      // Create a second user for a second review
      const user2 = await userRepo.create(createUserData());

      await reviewRepo.create(createReviewData(userId, movieId, { rating: 8 }));
      await reviewRepo.create(createReviewData(user2.id, movieId, { rating: 6 }));

      const avg = await reviewRepo.averageRating(movieId);
      expect(avg).toBe(7);
    });

    it('should return null when no reviews exist', async () => {
      const avg = await reviewRepo.averageRating(999999);
      expect(avg).toBeNull();
    });
  });
});
