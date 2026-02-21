# Plan 02 — Database & Prisma

## Goal
Define the database schema, set up Prisma, run the initial migration, and verify we can read/write data. By the end, all three tables exist in Postgres and repository-layer tests pass.

## Prerequisites
- Plan 01 complete (`bun install` done, Docker running)
- PostgreSQL container up on port 5432

---

## Schema

Three tables: **User**, **Movie**, **MovieReview**

```
┌──────────────┐        ┌──────────────────┐        ┌──────────────┐
│    User      │        │   MovieReview     │        │    Movie     │
├──────────────┤        ├──────────────────┤        ├──────────────┤
│ id       PK  │───┐    │ id           PK  │    ┌───│ id       PK  │
│ auth0Id  UQ  │   └───>│ userId       FK  │    │   │ title        │
│ email    UQ  │        │ movieId      FK  │<───┘   │ overview     │
│ username UQ? │        │ rating (1-10)    │        │ posterPath   │
│ avatarUrl    │        │ content      ?   │        │ backdropPath │
│ createdAt    │        │ createdAt        │        │ releaseDate  │
│ updatedAt    │        │ updatedAt        │        │ voteAverage  │
└──────────────┘        ├──────────────────┤        │ popularity   │
                        │ UQ(userId,       │        │ genres    [] │
                        │    movieId)      │        │ syncedAt     │
                        └──────────────────┘        └──────────────┘
```

---

## Prisma schema

### File: `backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  auth0Id   String   @unique
  email     String   @unique
  username  String?  @unique
  avatarUrl String?

  reviews   MovieReview[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Movie {
  id           Int      @id                    // TMDB movie ID — no auto-increment
  title        String
  overview     String
  posterPath   String?
  backdropPath String?
  releaseDate  DateTime?
  voteAverage  Float    @default(0)
  popularity   Float    @default(0)
  genres       String[]

  reviews      MovieReview[]

  syncedAt     DateTime @default(now())

  @@map("movies")
}

model MovieReview {
  id       String  @id @default(uuid())
  rating   Int                               // 1–10
  content  String?

  user     User    @relation(fields: [userId], references: [id])
  userId   String

  movie    Movie   @relation(fields: [movieId], references: [id])
  movieId  Int

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, movieId])                // one review per user per movie
  @@map("movie_reviews")
}
```

### Key decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Movie PK | `Int` (TMDB ID) | Natural key — we always look up by TMDB ID, avoids a separate `tmdbId` column |
| User PK | `uuid` | Auth0 ID is the external identifier, internal UUID for FKs |
| MovieReview PK | `uuid` | No natural key |
| Table mapping | `@@map("snake_case")` | Prisma models are PascalCase, SQL tables are snake_case (Postgres convention) |
| Rating constraint | Application-level (1–10) | Prisma doesn't support `CHECK` constraints natively — enforce in service layer + GraphQL schema validation |
| `username` nullable | Yes | Users may sign up via OAuth without choosing a username initially |
| `content` nullable | Yes | Users can leave a star rating without writing a review |

---

## TMDB sync strategy

| Data | TTL | Storage | Approach |
|------|-----|---------|----------|
| Movie detail | **24 hours** | DB (`syncedAt` column) | Upsert on access: if `syncedAt > 24h` or not in DB, fetch from TMDB and upsert |
| Trending / popular lists | **1 hour** | In-memory (`node-cache`) | Cache full list response, refresh after TTL |
| Search results | **5 minutes** | In-memory (`node-cache`) | Cache by query string, don't persist to DB |

Sync logic (in `movie.service.ts`, implemented in Plan 04):
```
getMovie(tmdbId):
  movie = db.findById(tmdbId)
  if movie AND movie.syncedAt > (now - 24h):
    return movie           // fresh enough, skip TMDB call
  tmdbData = tmdb.fetchMovie(tmdbId)
  return db.upsert(tmdbData)  // upsert + update syncedAt
```

---

## Files to create / modify

### 1. `backend/prisma/schema.prisma`
Full schema as defined above.

### 2. `backend/src/config/database.ts`
Prisma client singleton — one instance shared across the app:
```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export default prisma;
```

### 3. `backend/src/config/env.ts`
Typed environment variable validation (fail fast on startup if vars missing):
```ts
// Reads and validates: DATABASE_URL, AUTH0_DOMAIN, AUTH0_AUDIENCE,
// TMDB_API_KEY, SENTRY_DSN, BACKEND_PORT, FRONTEND_URL
// Throws on missing required vars
```

### 4. Repositories (scaffolded, full logic in Plan 04)
- `backend/src/repositories/user.repository.ts`
- `backend/src/repositories/movie.repository.ts`
- `backend/src/repositories/review.repository.ts`

Each repository gets basic CRUD scaffolded so we can write integration tests.

### 5. Integration tests
- `backend/src/repositories/__tests__/user.repository.test.ts`
- `backend/src/repositories/__tests__/movie.repository.test.ts`
- `backend/src/repositories/__tests__/review.repository.test.ts`

Tests run against a real test database (`movie_app_test`).

### 6. Test database setup
- Add `DATABASE_URL` override for tests pointing to `movie_app_test`
- Create a test helper that:
  - Resets the DB before each test suite (or each test)
  - Uses Prisma's `$transaction` for test isolation where appropriate

---

## Test database strategy

| Approach | How |
|----------|-----|
| Separate DB | `movie_app_test` — created alongside `movie_app` |
| Cleanup | `prisma migrate reset --force` before test suite run, or truncate tables between tests |
| docker-compose | No change needed — same Postgres container, different DB name |
| CI | Same pattern — test DB is ephemeral |

Add to `docker-compose.yml`: an init script that creates the test DB automatically:

### 7. `backend/pgadmin/init-test-db.sql`
```sql
SELECT 'CREATE DATABASE movie_app_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'movie_app_test');
```
Mounted into Postgres as an init script so `movie_app_test` is created on first `docker compose up`.

---

## Execution order

1. Create `backend/prisma/schema.prisma`
2. Add test DB init script, update `docker-compose.yml` to mount it
3. Run `docker compose up -d` (creates both `movie_app` and `movie_app_test`)
4. Run `bunx prisma migrate dev --name init` (creates tables)
5. Verify with `bunx prisma studio` — tables visible, empty
6. Create `backend/src/config/database.ts` (Prisma singleton)
7. Create `backend/src/config/env.ts` (env validation)
8. Scaffold repositories with basic CRUD
9. Create test helpers (DB reset, Prisma test client)
10. Write repository integration tests
11. Run `bun run test` — all pass
12. Commit: "feat: database schema, Prisma setup, repository layer with tests"

---

## Verification checklist

- [ ] `bunx prisma migrate dev --name init` succeeds
- [ ] Prisma Studio shows User, Movie, MovieReview tables
- [ ] pgAdmin shows tables under `movie_app` database
- [ ] `movie_app_test` database exists
- [ ] Repository tests pass (`bun run test`)
- [ ] Unique constraint works: can't insert two reviews for same user + movie
- [ ] Movie uses TMDB ID as PK (no auto-increment)
