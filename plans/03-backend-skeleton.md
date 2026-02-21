# Plan 03 — Backend Skeleton

## Goal
Wire up Fastify + Apollo Server so the backend starts, responds to a health check, serves the GraphQL playground, handles errors via Sentry, and shuts down gracefully. No business logic yet — just the frame.

## Prerequisites
- Phase 1 complete (tooling, deps installed)
- Phase 2 complete (Prisma schema, database running, repositories scaffolded)

---

## Files to create / modify

### 1. `src/config/instrument.ts` — Sentry initialisation
- Must be imported **before** all other modules (Sentry needs to patch early)
- Reads `SENTRY_DSN` from env — if empty, Sentry is disabled (no crash in local dev)
- Sets `environment` based on `NODE_ENV` (`development` / `production`)
- Configures tracing sample rate (1.0 in dev, 0.1–0.2 in prod)
- Exports nothing — side-effect-only import

### 2. `src/utils/errors.ts` — Custom GraphQL error classes
Built on top of Apollo Server's `GraphQLError`:
```ts
NotFoundError(message)       // extensions.code: "NOT_FOUND"
UnauthorizedError(message)   // extensions.code: "UNAUTHORIZED"
ForbiddenError(message)      // extensions.code: "FORBIDDEN"
ValidationError(message)     // extensions.code: "VALIDATION_ERROR"
```
Each is a function that returns a `GraphQLError` with the correct `extensions.code`. This keeps resolvers clean: `throw NotFoundError('Movie not found')`.

### 3. `src/utils/logger.ts` — Structured logger
- Wraps `console.info`, `console.warn`, `console.error`
- On `error`: also calls `Sentry.captureException()` so errors flow to Sentry
- On `warn`/`info`: adds Sentry breadcrumbs for context
- Exports: `logger.info(msg, meta?)`, `logger.warn(msg, meta?)`, `logger.error(msg, error?, meta?)`

### 4. `src/index.ts` — Server entry point
This is the main file. Replaces the current placeholder.

**Startup sequence:**
1. Import `./config/instrument.ts` (Sentry — must be first)
2. Import Fastify, Apollo, Prisma, CORS, env config
3. Create Fastify instance with logger enabled
4. Register `@fastify/cors` plugin (origin: `env.FRONTEND_URL`)
5. Register health check route: `GET /health` → `{ status: "ok", timestamp }`
6. Create Apollo Server instance with:
   - Type definitions (placeholder `Query { health: String }` for now — real schema in Phase 6)
   - Resolvers (placeholder `health` resolver)
   - Error formatting: log to Sentry, strip internal details in production
   - `introspection: true` (always on for now, restrict in prod later)
7. Start Apollo Server
8. Register Apollo as Fastify plugin via `@as-integrations/fastify`
9. Start Fastify on `env.BACKEND_PORT` (4000)
10. Log startup message with port

**Shutdown sequence:**
- Listen for `SIGTERM` and `SIGINT`
- Close Apollo Server
- Disconnect Prisma (`prisma.$disconnect()`)
- Close Fastify (`fastify.close()`)
- Log shutdown complete

### 5. `src/graphql/schema/index.ts` — Placeholder schema
- Minimal type defs so Apollo can start:
  ```graphql
  type Query {
    health: String
  }
  ```
- Minimal resolver: `health: () => "ok"`
- This gets replaced with the real schema in Phase 6

---

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Error classes | Functions returning `GraphQLError` | Simpler than class inheritance, same result. Apollo 4 uses `GraphQLError` directly, not custom subclasses. |
| Logger approach | Thin wrapper over console + Sentry | No need for winston/pino — Fastify has its own logger for HTTP, we just need app-level logging to Sentry. Keep it simple. |
| Sentry init | Side-effect import at top of `index.ts` | Sentry docs require early init. Separating it into its own file keeps `index.ts` clean. |
| Placeholder schema | Yes, minimal `health` query | Apollo needs at least one query to start. Real schema comes in Phase 6. |
| CORS | `@fastify/cors` with `FRONTEND_URL` origin | Standard approach. Allow the frontend URL only, not `*`. |
| Introspection | Always on for now | Restrict in production later. During dev we want Apollo Sandbox to work. |

---

## Execution order

1. Create `src/config/instrument.ts` (Sentry)
2. Create `src/utils/errors.ts` (custom error classes)
3. Create `src/utils/logger.ts` (logger with Sentry)
4. Create `src/graphql/schema/index.ts` (placeholder schema)
5. Rewrite `src/index.ts` (full server entry point)
6. Run `bun run dev` — verify server starts
7. Test: `curl localhost:4000/health` → `{ status: "ok", timestamp: "..." }`
8. Test: open `localhost:4000/graphql` → Apollo Sandbox loads
9. Test: run `{ health }` query in sandbox → returns `"ok"`
10. Write tests (server start/stop, health check, 404 on unknown routes)
11. Run `bun run lint` + `bun run format:check` + `bun run test` — all pass
12. Commit: "feat: backend skeleton — Fastify, Apollo Server, health check, Sentry"

---

## Tests

### `src/__tests__/server.test.ts`
- **Server starts**: create Fastify instance → inject health check → 200
- **Health check response**: `GET /health` returns `{ status: "ok", timestamp }` where timestamp is a valid ISO date
- **GraphQL endpoint**: `POST /graphql` with `{ query: "{ health }" }` returns `{ data: { health: "ok" } }`
- **Unknown route**: `GET /nonexistent` returns 404
- **Graceful shutdown**: server starts → close() → no hanging connections

Test approach: use Fastify's built-in `inject()` method (no real HTTP server needed, faster tests).

---

## Verification checklist

- [ ] `bun run dev` starts server on port 4000, no errors
- [ ] `curl localhost:4000/health` returns `{ status: "ok", timestamp: "..." }`
- [ ] Apollo Sandbox loads at `localhost:4000/graphql`
- [ ] `{ health }` query returns `"ok"` in sandbox
- [ ] CORS headers present (check with `curl -I -H "Origin: http://localhost:3000"`)
- [ ] Ctrl+C triggers graceful shutdown (logs "shutting down" message)
- [ ] `bun run lint` passes
- [ ] `bun run format:check` passes
- [ ] `bun run test` passes (existing 28 repo tests + new server tests)
