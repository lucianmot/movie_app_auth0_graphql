# Movie App - Auth0 + GraphQL

A full-stack movie application powered by [TMDB API](https://developer.themoviedb.org/docs/getting-started). Users can browse and search movies, and authenticated users can write ratings and reviews.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, TypeScript, Express, Apollo Server 4 |
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, Apollo Client |
| **Database** | PostgreSQL 16 (via Docker Compose), Prisma 6 ORM |
| **Auth** | Auth0 (JWT on backend, `@auth0/nextjs-auth0` on frontend) |
| **Monitoring** | Sentry (error tracking + logging) |
| **Monorepo** | pnpm workspaces |

---

## Architecture

### 3-Layer Backend

```
[GraphQL Resolvers]  ← controller layer: validates auth, parses input, delegates
        │
   [Services]        ← business logic, Sentry logging, orchestration
        │
 [Repositories]      ← Prisma DB calls (reviews, users)
 [TMDBService]       ← external TMDB API calls with in-memory cache
```

### Auth Flow

```
Browser → Auth0 Login → JWT issued → stored in session cookie (Next.js)
                                          │
Browser → GraphQL request + Bearer token → Express + Apollo Server (:4000)
                                                │
                                     Optional JWT middleware
                                     (validates via Auth0 JWKS)
                                                │
                                         Apollo Context
                                    { user: JWT | null, prisma }
```

- Public queries (trending, search, movie details) work **without** auth
- Mutations (create/update/delete review) **require** auth
- User is upserted in PostgreSQL on first authenticated request

---

## Database Schema

Two models — movies are **NOT** stored locally, they're fetched from TMDB at runtime.

### User
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| auth0Id | String | Unique, maps to Auth0 `sub` claim |
| email | String | Unique |
| name | String? | Optional |
| picture | String? | Optional avatar URL |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

### Review
| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| tmdbId | Int | TMDB movie ID (external reference, not FK) |
| rating | Int | 1–10 scale |
| title | String? | Optional review title |
| body | Text? | Optional review body |
| userId | String | FK → User |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Constraints:**
- `@@unique([userId, tmdbId])` — one review per user per movie
- `@@index([tmdbId])` — fast lookup for all reviews on a movie
- `@@index([userId])` — fast lookup for all reviews by a user

---

## GraphQL Schema

### Queries
| Query | Auth Required | Description |
|-------|:---:|-------------|
| `trendingMovies(page, timeWindow)` | No | Trending movies (day/week) |
| `popularMovies(page)` | No | Popular movies |
| `searchMovies(query, page)` | No | Search movies by title |
| `movie(id)` | No | Single movie details |
| `reviewsForMovie(tmdbId, page, limit)` | No | All reviews for a movie |
| `me` | Yes | Current authenticated user |
| `myReviews` | Yes | Current user's reviews |

### Mutations
| Mutation | Auth Required | Description |
|----------|:---:|-------------|
| `createReview(input)` | Yes | Create a new review (rating + optional title/body) |
| `updateReview(id, input)` | Yes | Update own review |
| `deleteReview(id)` | Yes | Delete own review |

### Types
- `Movie` — id, title, overview, posterPath, backdropPath, releaseDate, voteAverage, genres, runtime, tagline, reviews, averageUserRating
- `MovieConnection` — results, page, totalPages, totalResults (pagination)
- `Genre` — id, name
- `User` — id, email, name, picture, reviews
- `Review` — id, tmdbId, rating, title, body, user, timestamps

---

## TMDB Integration

The backend `TMDBService` fetches from `https://api.themoviedb.org/3` using Bearer token auth.

| Endpoint | Cache TTL | Purpose |
|----------|-----------|---------|
| `/trending/movie/{day\|week}` | 10 min | Trending movies |
| `/movie/popular` | 10 min | Popular movies |
| `/search/movie?query=` | 2 min | Search |
| `/movie/{id}` | 10 min | Movie details |

Caching uses `node-cache` (simple in-memory TTL cache). Redis would be overkill for an MVP.

---

## Folder Structure

```
/
├── pnpm-workspace.yaml
├── package.json                          # Root workspace scripts
├── docker-compose.yml                    # PostgreSQL
├── .env.example
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── nodemon.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.ts                      # Express + Apollo Server entry point
│       ├── instrument.ts                 # Sentry init (must import first)
│       ├── config/
│       │   ├── env.ts                    # Typed env var validation
│       │   ├── database.ts              # Prisma client singleton
│       │   └── auth.ts                  # Auth0 JWT config
│       ├── schema/
│       │   ├── typeDefs/
│       │   │   ├── index.ts             # Merges all type defs
│       │   │   ├── movie.graphql
│       │   │   ├── user.graphql
│       │   │   └── review.graphql
│       │   └── resolvers/
│       │       ├── index.ts             # Merges all resolvers
│       │       ├── movie.resolver.ts
│       │       ├── user.resolver.ts
│       │       └── review.resolver.ts
│       ├── services/
│       │   ├── tmdb.service.ts          # TMDB API client + cache
│       │   ├── movie.service.ts         # Movie business logic
│       │   ├── review.service.ts        # Review CRUD + Sentry logging
│       │   └── user.service.ts          # User sync/lookup + Sentry logging
│       ├── repositories/
│       │   ├── review.repository.ts     # Prisma calls for reviews
│       │   └── user.repository.ts       # Prisma calls for users
│       ├── middleware/
│       │   └── auth.middleware.ts        # Optional JWT validation
│       ├── types/
│       │   ├── context.ts               # Apollo context type
│       │   └── tmdb.ts                  # TMDB response types
│       └── utils/
│           ├── errors.ts                # Custom GraphQL error classes
│           └── logger.ts                # Sentry-backed logger
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── middleware.ts                     # Auth0 session middleware
│   └── src/
│       ├── app/
│       │   ├── layout.tsx               # Root: Auth0Provider + ApolloProvider
│       │   ├── page.tsx                 # Home: trending movies
│       │   ├── loading.tsx              # Global loading skeleton
│       │   ├── auth/
│       │   │   └── [...auth0]/
│       │   │       └── route.ts         # Auth0 catch-all route handler
│       │   ├── movies/
│       │   │   ├── page.tsx             # Browse + search movies
│       │   │   └── [id]/
│       │   │       ├── page.tsx         # Movie detail + reviews
│       │   │       └── loading.tsx
│       │   └── profile/
│       │       └── page.tsx             # User's reviews
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.tsx
│       │   │   └── Footer.tsx
│       │   ├── movies/
│       │   │   ├── MovieCard.tsx
│       │   │   ├── MovieGrid.tsx
│       │   │   ├── MovieSearch.tsx
│       │   │   └── MovieDetails.tsx
│       │   ├── reviews/
│       │   │   ├── ReviewForm.tsx
│       │   │   ├── ReviewList.tsx
│       │   │   ├── ReviewCard.tsx
│       │   │   └── StarRating.tsx
│       │   ├── auth/
│       │   │   ├── LoginButton.tsx
│       │   │   ├── LogoutButton.tsx
│       │   │   └── AuthGuard.tsx
│       │   └── ui/
│       │       ├── Spinner.tsx
│       │       └── ErrorMessage.tsx
│       ├── lib/
│       │   ├── apollo-client.ts         # Apollo Client factory
│       │   └── apollo-provider.tsx      # ApolloNextAppProvider wrapper
│       └── graphql/
│           ├── queries/
│           │   ├── movies.ts
│           │   └── reviews.ts
│           ├── mutations/
│           │   └── reviews.ts
│           └── fragments/
│               ├── movie.ts
│               └── review.ts
```

---

## Dependencies

### Backend
**Production:** `@apollo/server`, `@as-integrations/express4`, `express`, `cors`, `graphql`, `graphql-tag`, `@prisma/client`, `@sentry/node`, `express-oauth2-jwt-bearer`, `jwks-rsa`, `node-cache`, `dotenv`

**Dev:** `typescript`, `ts-node`, `nodemon`, `@types/node`, `@types/express`, `@types/cors`, `prisma`

### Frontend
**Additional** (on top of create-next-app defaults): `@apollo/client`, `@apollo/experimental-nextjs-app-support`, `graphql`, `@auth0/nextjs-auth0`

---

## Implementation Order

### Phase 1 — Project Scaffolding
1. Root `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.env.example`
2. `docker-compose.yml` for PostgreSQL
3. Backend: `package.json`, `tsconfig.json`, `nodemon.json`, install deps
4. Frontend: `create-next-app` with TypeScript + Tailwind, install extra deps

### Phase 2 — Backend Foundation
5. Prisma schema + first migration (`prisma migrate dev --name init`)
6. `src/config/` — env validation, Prisma singleton, Sentry init
7. `src/utils/` — error classes, Sentry logger

### Phase 3 — Backend 3-Layer (Bottom-Up)
8. **Repositories**: `user.repository.ts`, `review.repository.ts`
9. **Services**: `tmdb.service.ts`, `movie.service.ts`, `user.service.ts`, `review.service.ts`
10. Auth middleware (optional JWT validation)

### Phase 4 — Backend GraphQL Layer
11. GraphQL type definitions (`.graphql` files)
12. GraphQL resolvers (movie, user, review)
13. `src/index.ts` — wire Express + Apollo Server + middleware

**Checkpoint:** Apollo Sandbox at `http://localhost:4000/graphql` — test trending, search, movie detail queries

### Phase 5 — Frontend Foundation
14. Apollo Client setup (`lib/apollo-client.ts`, `lib/apollo-provider.tsx`)
15. Auth0 route handler + middleware
16. Root layout with providers
17. GraphQL query/mutation documents

### Phase 6 — Frontend Pages & Components
18. Navbar with search + auth buttons
19. MovieCard, MovieGrid components
20. Home page (trending movies)
21. Browse + search page
22. Movie detail page with reviews
23. ReviewForm, ReviewList, StarRating components
24. Profile page (user's reviews)

### Phase 7 — Polish
25. Loading states, error handling, skeletons
26. Build verification (`pnpm build`)

---

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Backend `.env` | PostgreSQL connection string |
| `AUTH0_DOMAIN` | Backend `.env` | Auth0 tenant domain |
| `AUTH0_AUDIENCE` | Backend `.env` | Auth0 API audience |
| `TMDB_API_KEY` | Backend `.env` | TMDB read access token |
| `SENTRY_DSN` | Backend `.env` | Sentry DSN |
| `BACKEND_PORT` | Backend `.env` | Server port (default: 4000) |
| `FRONTEND_URL` | Backend `.env` | CORS origin (default: http://localhost:3000) |
| `AUTH0_SECRET` | Frontend `.env.local` | Session encryption key |
| `AUTH0_BASE_URL` | Frontend `.env.local` | App base URL |
| `AUTH0_ISSUER_BASE_URL` | Frontend `.env.local` | Auth0 issuer URL |
| `AUTH0_CLIENT_ID` | Frontend `.env.local` | Auth0 client ID |
| `AUTH0_CLIENT_SECRET` | Frontend `.env.local` | Auth0 client secret |
| `NEXT_PUBLIC_GRAPHQL_URL` | Frontend `.env.local` | GraphQL endpoint URL |

---

## Getting Started (after implementation)

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Copy env files and fill in your keys
cp .env.example backend/.env
cp .env.example frontend/.env.local

# 3. Run database migration
pnpm db:migrate

# 4. Start both backend and frontend
pnpm dev

# Backend: http://localhost:4000/graphql (Apollo Sandbox)
# Frontend: http://localhost:3000
```
