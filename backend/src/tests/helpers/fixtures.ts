import type { Prisma } from '@prisma/client';

export function createUserData(
  overrides: Partial<Prisma.UserCreateInput> = {},
): Prisma.UserCreateInput {
  const id = crypto.randomUUID();
  return {
    auth0Id: `auth0|${id}`,
    email: `user-${id}@test.com`,
    ...overrides,
  };
}

export function createMovieData(
  id: number,
  overrides: Partial<Omit<Prisma.MovieCreateInput, 'id'>> = {},
): Prisma.MovieCreateInput {
  return {
    id,
    title: `Test Movie ${id}`,
    overview: `Overview for movie ${id}`,
    posterPath: `/poster-${id}.jpg`,
    voteAverage: 7.5,
    popularity: 100,
    genres: ['Action', 'Drama'],
    ...overrides,
  };
}

export function createReviewData(
  userId: string,
  movieId: number,
  overrides: Partial<Prisma.MovieReviewUncheckedCreateInput> = {},
): Prisma.MovieReviewUncheckedCreateInput {
  return {
    userId,
    movieId,
    rating: 8,
    content: 'Great movie!',
    ...overrides,
  };
}
