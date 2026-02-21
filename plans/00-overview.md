# Backend Implementation — Plan Overview

Eight phases, each building on the last. Every phase ends with passing tests.

---

## Phase 1 — Tooling & DX `[DONE]`
> Get a developer from `git clone` to a working dev environment in one command.

- Root `package.json` with Bun workspaces (proxy scripts to backend)
- `.gitignore`, `.env.example`
- `docker-compose.yml` — PostgreSQL 16 + pgAdmin 4 (infrastructure only, app runs natively)
- Backend `package.json` — all production + dev dependencies
- `tsconfig.json` — strict mode, ES2022, NodeNext module resolution
- ESLint 9 flat config + `eslint-config-prettier`
- Prettier config (single quotes, trailing commas, 100 char width)
- Vitest config — v8 coverage provider, `src/**/*.test.ts` pattern
- Dummy `src/index.ts` entry point

**Verify**: `bun install` → `bun run build` → `bun run lint` → `bun run format:check` → `bun run test` — all pass.

**Detailed plan**: [01-backend-tooling-dx.md](01-backend-tooling-dx.md)

---

## Phase 2 — Database & Prisma `[DONE]`
> Three tables in Postgres, Prisma managing migrations, repositories tested against a real DB.

- `docker compose up -d` — Postgres + pgAdmin running
- `backend/prisma/schema.prisma` — User, Movie, MovieReview models
  - **User**: uuid PK, auth0Id (unique), email (unique), username (optional, unique), avatarUrl
  - **Movie**: int PK (TMDB ID directly), title, overview, posterPath, backdropPath, releaseDate, voteAverage, popularity, genres (`String[]`), syncedAt (24h TTL for TMDB refresh)
  - **MovieReview**: uuid PK, userId FK, movieId FK, rating (1–10), content (optional), unique constraint on (userId, movieId)
- Init script to auto-create `movie_app_test` database alongside `movie_app`
- `src/config/database.ts` — Prisma client singleton
- `src/config/env.ts` — typed env validation, fail-fast on missing vars
- Scaffold repositories: `user.repository.ts`, `movie.repository.ts`, `review.repository.ts` (basic CRUD)
- Test helpers: DB reset between runs, separate test Prisma client pointing to `movie_app_test`
- Integration tests for all three repositories (create, read, update, delete, constraint checks)

**Verify**: `bunx prisma migrate dev --name init` succeeds → Prisma Studio shows tables → `bun run test` passes → unique constraint enforced.

**Detailed plan**: [02-database.md](02-database.md)

---

## Phase 3 — Backend Skeleton
> Fastify + Apollo Server wired up, server starts, health check responds, Sentry captures errors.

- `src/index.ts` — Fastify server creation, Apollo Server 4 integration via `@as-integrations/fastify`
- CORS configured via `@fastify/cors` (allow `FRONTEND_URL`)
- Sentry initialisation (`src/config/instrument.ts`) — must load before other imports
- `src/utils/errors.ts` — custom GraphQL error classes (NotFoundError, UnauthorizedError, ValidationError, etc.)
- `src/utils/logger.ts` — structured logger wrapping Sentry breadcrumbs
- Health check route: `GET /health` returns `{ status: "ok", timestamp }` (bypasses GraphQL)
- GraphQL playground available at `GET /graphql` in development
- Graceful shutdown: close Prisma connection + drain Fastify on SIGTERM/SIGINT

**Verify**: `bun run dev` → server starts on port 4000 → `curl localhost:4000/health` returns 200 → Apollo Sandbox loads at `localhost:4000/graphql`.

**Tests**: Server starts and shuts down cleanly, health check returns 200, invalid routes return 404.

**Detailed plan**: [03-backend-skeleton.md](03-backend-skeleton.md)

---

## Phase 4 — Repositories & Services
> Business logic layer complete — all data access through repositories, all logic through services, all tested.

**Repositories** (full implementations, building on Phase 2 scaffolds):
- `user.repository.ts` — findByAuth0Id, findById, create, update
- `movie.repository.ts` — findById, upsert (for TMDB sync), findMany (with pagination)
- `review.repository.ts` — create, update, delete, findByUserAndMovie, findByMovie (paginated), findByUser (paginated)

**Services** (depend on repositories, contain business logic):
- `tmdb.service.ts` — TMDB API client wrapping fetch, in-memory cache (`node-cache`): 1h for trending/popular, 5min for search results
- `movie.service.ts` — getMovie (with 24h DB cache + TMDB fallback), getTrending, getPopular, searchMovies
- `user.service.ts` — findOrCreateUser (upsert on first login via Auth0 ID), updateProfile
- `review.service.ts` — createReview (validates rating 1–10, enforces one-per-movie), updateReview, deleteReview (ownership check), getMovieReviews (with avg rating), getUserReviews

**Tests**:
- Repository integration tests: CRUD against `movie_app_test` DB
- Service unit tests: mocked repositories via `vi.mock`, mocked TMDB HTTP responses
- Edge cases: duplicate review (unique constraint), rating out of range, non-existent movie, TMDB API failure/timeout

---

## Phase 5 — Auth
> JWT verification via Auth0 JWKS — protected mutations, public queries, proper error responses.

- `src/plugins/auth.plugin.ts` — Fastify plugin using `onRequest` hook
  - Fetches Auth0 JWKS public keys via `jwks-rsa` (cached)
  - Verifies JWT with `fast-jwt` (checks issuer, audience, expiry)
  - Attaches decoded user to Fastify request (`request.user`)
  - Does NOT block requests — just decodes if token present (resolvers decide what needs auth)
- `src/context.ts` — builds GraphQL context from Fastify request, provides `user | null` + `prisma` to resolvers
- Auth helpers: `requireAuth(context)` throws `UnauthorizedError` if no valid token

**Tests**:
- Valid token → user decoded and attached to context
- Expired token → null user (or error depending on resolver)
- Missing token → null user (public queries still work)
- Malformed / invalid signature → rejected
- JWKS endpoint unreachable → graceful error (Sentry alert)

---

## Phase 6 — GraphQL Layer
> Full API — type definitions, resolvers wired to services, authenticated mutations, public queries.

**Schema** (`src/graphql/schema/*.graphql`):
- Types: `Movie`, `User`, `MovieReview`, `PaginatedMovies`, `PaginatedReviews`, `MovieWithStats`
- Queries: `movie(id: Int!)`, `movies(page: Int)`, `trending(page: Int)`, `searchMovies(query: String!, page: Int)`, `myReviews`, `movieReviews(movieId: Int!)`
- Mutations: `createReview(input: CreateReviewInput!)`, `updateReview(id: ID!, input: UpdateReviewInput!)`, `deleteReview(id: ID!)`, `updateProfile(input: UpdateProfileInput!)`
- Input types: `CreateReviewInput { movieId: Int!, rating: Int!, content: String }`, `UpdateReviewInput { rating: Int, content: String }`, `UpdateProfileInput { username: String, avatarUrl: String }`

**Resolvers** (`src/graphql/resolvers/`):
- `movie.resolver.ts` — all movie queries (public, no auth required)
- `review.resolver.ts` — createReview/updateReview/deleteReview require auth, movieReviews is public
- `user.resolver.ts` — myReviews/updateProfile require auth
- Field resolvers: `Movie.reviews`, `MovieReview.user`, `MovieReview.movie` (for nested queries)

**Tests**:
- Integration tests: spin up server, send GraphQL queries/mutations via HTTP
- Unauthenticated queries: browse movies, view reviews — should work
- Authenticated mutations: create/update/delete review — need valid JWT mock
- Error cases: create review without auth (401), duplicate review (409), invalid rating (400), movie not found (404)

---

## Phase 7 — Seed Data & Developer Experience
> Sample data so the app isn't empty on first run, scripts polished.

- `backend/prisma/seed.ts` — seed script that:
  - Creates 2–3 test users (with fake Auth0 IDs for local dev)
  - Fetches 10–20 popular movies from TMDB and upserts into DB
  - Creates sample reviews across users and movies
- `bun run db:seed` script wired up
- Prisma seed config in `package.json` (`"prisma": { "seed": "bun run prisma/seed.ts" }`)

**Verify**: `bunx prisma migrate reset` → re-runs migrations + seed → Prisma Studio shows populated data → GraphQL queries return results.

---

## Phase 8 — End-to-End Verification
> Full flow tests proving everything works together. Build passes. Ready for frontend.

**E2E test scenarios** (`src/__tests__/e2e/`):
- Browse movies: query trending → returns list from TMDB (via cache)
- Search: query searchMovies("Inception") → returns results
- Movie detail: query movie(id) → returns movie with TMDB data
- Review flow: createReview → read back via movieReviews → updateReview → verify update → deleteReview → verify gone
- Auth enforcement: mutation without token → UnauthorizedError
- Constraint enforcement: second review for same movie → error
- Validation: rating 0 → error, rating 11 → error
- TMDB cache: query same movie twice → second call skips TMDB (syncedAt fresh)

**Final checks**:
- `bun run build` compiles with no errors
- `bun run lint` passes
- `bun run format:check` passes
- `bun run test` — all tests pass (unit + integration + e2e)
- `bun run test:coverage` — coverage report generated
- `bun run dev` → server starts → Apollo Sandbox works at `localhost:4000/graphql`

---

## Dependency graph

```
Phase 1 (Tooling)
    │
    ▼
Phase 2 (Database)
    │
    ▼
Phase 3 (Skeleton)
    │
    ▼
Phase 4 (Repos & Services)
    │
    ▼
Phase 5 (Auth)
    │
    ▼
Phase 6 (GraphQL)
    │
    ▼
Phase 7 (Seed Data)
    │
    ▼
Phase 8 (E2E Verification)
```

Each phase has its own detailed plan in this folder. Plans are written as we get to them.
