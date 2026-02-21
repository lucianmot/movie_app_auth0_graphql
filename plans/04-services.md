# Plan 04 — Services Layer

## Goal
Add the business logic layer between repositories and the future GraphQL resolvers. Repositories are already complete (28 integration tests). This phase creates four services with full unit test coverage.

## Prerequisites
- Phase 1 complete (tooling, deps installed)
- Phase 2 complete (Prisma schema, repositories with CRUD + tests)
- Phase 3 complete (Fastify + Apollo Server skeleton, health check, Sentry, 5 server tests)

---

## Files to create

### 1. `src/types/tmdb.types.ts` — TMDB API response types

TypeScript interfaces for the TMDB API v3 response shapes:

```ts
TmdbMovie              // list result: id, title, overview, poster_path, backdrop_path,
                        //   release_date, vote_average, popularity, genre_ids (number[])
TmdbMovieDetail        // detail result: same fields but genres ({ id, name }[]) instead of genre_ids
TmdbGenre              // { id: number; name: string }
TmdbPaginatedResponse  // { page, results: TmdbMovie[], total_pages, total_results }
```

TMDB list endpoints (`/trending`, `/popular`, `/search`) return `genre_ids` (number arrays), while the detail endpoint (`/movie/{id}`) returns full `genres` objects. The types reflect this.

### 2. `src/services/tmdb.service.ts` — TMDB API client

**Pattern**: Factory with DI — `createTmdbService({ fetchFn?, cache? })` + default export singleton.

Injecting `fetchFn` and `NodeCache` lets tests avoid real HTTP calls and cache pollution.

**Methods**:
| Method | TMDB endpoint | Cache TTL | Cache key |
|--------|--------------|-----------|-----------|
| `getMovie(id)` | `/movie/{id}` | 1h | `tmdb:movie:{id}` |
| `getTrending(page)` | `/trending/movie/week?page={page}` | 1h | `tmdb:trending:{page}` |
| `getPopular(page)` | `/movie/popular?page={page}` | 1h | `tmdb:popular:{page}` |
| `searchMovies(query, page)` | `/search/movie?query={query}&page={page}` | 5min | `tmdb:search:{query}:{page}` |

**Internal helper**: `tmdbFetch<T>(path)` — builds full URL from `https://api.themoviedb.org/3`, sets `Authorization: Bearer {TMDB_API_KEY}` header, 5s timeout via `AbortSignal.timeout(5000)`, throws on non-2xx.

### 3. `src/services/movie.service.ts` — Movie orchestration

**Pattern**: `createMovieService({ movieRepo?, tmdb? })` + default singleton.

**Methods**:
- `getMovie(id)` → `Movie` — the core logic:
  1. Check DB via `movieRepo.findById(id)`
  2. If found and fresh (syncedAt < 24h) → return from DB, no TMDB call
  3. Otherwise fetch from TMDB → `movieRepo.upsert()` → return
  4. If TMDB fails but stale DB data exists → return stale data + log warning
  5. If TMDB fails and no DB data → throw `NotFoundError`
- `getTrending(page)` → pass-through to `tmdb.getTrending()`
- `getPopular(page)` → pass-through to `tmdb.getPopular()`
- `searchMovies(query, page)` → pass-through to `tmdb.searchMovies()`

**Private helper**: `mapTmdbDetailToMovie(detail)` — transforms `TmdbMovieDetail` to Prisma `MovieCreateInput`:
- `poster_path` → `posterPath`, `backdrop_path` → `backdropPath`, etc.
- `genres: [{ id, name }]` → `genres: ["Action", "Drama"]` (name strings only)
- `release_date: "2024-05-15"` → `releaseDate: new Date(...)` or `null`

**Design decision**: Only `getMovie` syncs to DB. List endpoints do NOT write to DB — avoids writing hundreds of movies on each browse page. Individual movies sync when users view their detail page.

### 4. `src/services/user.service.ts` — User management

**Pattern**: `createUserService({ userRepo? })` + default singleton.

**Methods**:
- `findOrCreateUser(auth0Id, email)` → `User`
  - Find by auth0Id → if found, return
  - If not found → create
  - Handle race condition: if create throws unique constraint (two simultaneous first requests), retry `findByAuth0Id`
- `updateProfile(userId, { username?, avatarUrl? })` → `User`
  - Delegates to repo
  - Catches Prisma P2025 → `NotFoundError('User not found')`
  - Catches Prisma P2002 → `ValidationError('Username is already taken')`
- `findById(id)` → `User`
  - Returns user or throws `NotFoundError`

### 5. `src/services/review.service.ts` — Review business logic

**Pattern**: `createReviewService({ reviewRepo? })` + default singleton.

**Methods**:
- `createReview(userId, movieId, { rating, content? })` → `MovieReview`
  - Validates: rating must be integer 1-10 → `ValidationError`
  - Checks `findByUserAndMovie` → if exists, `ValidationError('You have already reviewed this movie')`
  - Creates via repo
- `updateReview(reviewId, userId, { rating?, content? })` → `MovieReview`
  - Finds by id → `NotFoundError` if missing
  - Checks `review.userId === userId` → `ForbiddenError('You can only edit your own reviews')` if not owner
  - Validates rating if provided (same 1-10 integer check)
  - Updates via repo
- `deleteReview(reviewId, userId)` → `MovieReview`
  - Same find + ownership check pattern as update
  - Deletes via repo
- `getMovieReviews(movieId, page?, pageSize?)` → `{ reviews, averageRating }`
  - Parallel fetch: `Promise.all([findByMovie, averageRating])`
- `getUserReviews(userId, page?, pageSize?)` → `MovieReview[]`
  - Delegates to `findByUser`

---

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Service pattern | Factory with DI (same as repos) | Tests inject mocks via constructor, no `vi.mock` needed for repos |
| TMDB cache library | `node-cache` (already installed) | Simple, in-memory, sufficient for single-process backend |
| DB sync strategy | Only on `getMovie` (detail page) | Avoids mass writes on browse pages. Movies sync lazily when users drill into detail |
| Stale data fallback | Return stale DB data when TMDB fails | Better UX: user sees slightly old data rather than an error. Logged as warning for monitoring |
| Rating validation | Application-level check + DB unique constraint | App check gives clear error message, DB constraint is ultimate safety net |
| Ownership check | Compare `review.userId === userId` | Simple string equality, no extra DB query needed |
| Race condition handling | Catch unique constraint, retry find | Handles concurrent first-login without distributed locks |

---

## Tests

All service tests are **unit tests** — mock repositories via DI, mock fetch for TMDB. No database needed.

| Test file | What's tested | ~Tests |
|-----------|---------------|--------|
| `tmdb.service.test.ts` | Correct URLs/headers, caching (call twice = 1 fetch), pagination, error on non-200, timeout | ~12 |
| `movie.service.test.ts` | Fresh DB hit (no TMDB call), stale triggers TMDB, no DB triggers TMDB, TMDB fail + stale fallback, TMDB fail + no DB = NotFoundError, field mapping | ~10 |
| `user.service.test.ts` | Find existing user, create new, race condition retry, updateProfile, username taken, findById not found | ~8 |
| `review.service.test.ts` | Valid create, rating validation (0, 11, 7.5), duplicate review, update with/without ownership, delete with/without ownership, getMovieReviews parallel, getUserReviews | ~15 |

**Mock strategy**: Inject mock objects via factory DI in `beforeEach`:
```ts
let mockRepo: Record<string, ReturnType<typeof vi.fn>>;
let service: ReturnType<typeof createXService>;
beforeEach(() => {
  mockRepo = { findById: vi.fn(), create: vi.fn(), ... };
  service = createXService({ xRepo: mockRepo as any });
});
```

For `tmdb.service.test.ts` — also mock `env.TMDB_API_KEY` via `vi.mock('../../config/env.js', ...)` and `logger` via `vi.mock('../../utils/logger.js', ...)`.

---

## Execution order

1. Create `src/types/tmdb.types.ts` (no dependencies)
2. Create `src/services/tmdb.service.ts` (depends on types)
3. Create `src/services/__tests__/tmdb.service.test.ts` → run tests, verify passing
4. Create `src/services/movie.service.ts` (depends on tmdb service + movie repo)
5. Create `src/services/__tests__/movie.service.test.ts` → run tests
6. Create `src/services/user.service.ts` (depends on user repo)
7. Create `src/services/__tests__/user.service.test.ts` → run tests
8. Create `src/services/review.service.ts` (depends on review repo)
9. Create `src/services/__tests__/review.service.test.ts` → run tests

---

## Repository modifications

**None required.** The existing repository interfaces are complete:
- `userRepository`: findById, findByAuth0Id, findByEmail, create, update
- `movieRepository`: findById, findMany, upsert
- `reviewRepository`: findById, findByUserAndMovie, findByMovie, findByUser, create, update, delete, averageRating

---

## Verification checklist

- [ ] `bun run test` — all ~78 tests pass (33 existing + ~45 new)
- [ ] `bun run lint` — passes
- [ ] `bun run format:check` — passes
- [ ] `bun run build` — TypeScript compiles cleanly
