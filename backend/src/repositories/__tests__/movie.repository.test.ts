import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testPrisma, cleanDatabase } from '../../tests/helpers/prisma.js';
import { createMovieRepository } from '../movie.repository.js';
import { createMovieData } from '../../tests/helpers/fixtures.js';

const movieRepo = createMovieRepository(testPrisma);

beforeAll(async () => {
  await cleanDatabase();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('movieRepository', () => {
  describe('upsert', () => {
    it('should create a movie when it does not exist', async () => {
      const { id: _id, ...data } = createMovieData(550);
      const movie = await movieRepo.upsert(550, data);

      expect(movie.id).toBe(550);
      expect(movie.title).toBe(data.title);
      expect(movie.genres).toEqual(['Action', 'Drama']);
      expect(movie.syncedAt).toBeInstanceOf(Date);
    });

    it('should update a movie when it already exists', async () => {
      const { id: _id, ...data } = createMovieData(550);
      await movieRepo.upsert(550, data);

      const updated = await movieRepo.upsert(550, { ...data, title: 'Updated Title' });

      expect(updated.id).toBe(550);
      expect(updated.title).toBe('Updated Title');
    });

    it('should update syncedAt on upsert', async () => {
      const { id: _id, ...data } = createMovieData(550);
      const first = await movieRepo.upsert(550, data);
      const second = await movieRepo.upsert(550, data);

      expect(second.syncedAt.getTime()).toBeGreaterThanOrEqual(first.syncedAt.getTime());
    });
  });

  describe('findById', () => {
    it('should find a movie by TMDB id', async () => {
      const { id: _id, ...data } = createMovieData(550);
      await movieRepo.upsert(550, data);

      const found = await movieRepo.findById(550);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(550);
    });

    it('should return null for non-existent movie', async () => {
      const found = await movieRepo.findById(999999);
      expect(found).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should return movies ordered by popularity', async () => {
      const { id: _id1, ...data1 } = createMovieData(1, { popularity: 50 });
      const { id: _id2, ...data2 } = createMovieData(2, { popularity: 100 });
      const { id: _id3, ...data3 } = createMovieData(3, { popularity: 75 });

      await movieRepo.upsert(1, data1);
      await movieRepo.upsert(2, data2);
      await movieRepo.upsert(3, data3);

      const movies = await movieRepo.findMany();

      expect(movies).toHaveLength(3);
      expect(movies[0].id).toBe(2);
      expect(movies[1].id).toBe(3);
      expect(movies[2].id).toBe(1);
    });

    it('should support pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        const { id: _id, ...data } = createMovieData(i, { popularity: i });
        await movieRepo.upsert(i, data);
      }

      const page1 = await movieRepo.findMany(1, 2);
      const page2 = await movieRepo.findMany(2, 2);

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });
});
