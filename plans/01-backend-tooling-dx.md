# Plan 01 — Backend Tooling & DX

## Goal
Set up the project skeleton so that a developer can clone, install, and have linting, formatting, TypeScript compilation, and test running all working before any application code is written.

## Current state
- Only `README.md` and `backend/README.md` exist (committed)
- No package.json, no configs, no source files

---

## Files to create

### 1. Root `package.json`
- Bun workspaces: `"workspaces": ["backend"]` (frontend added later)
- Root scripts that proxy into the backend workspace:
  ```
  dev         → bun --filter backend dev
  build       → bun --filter backend build
  lint        → bun --filter backend lint
  lint:fix    → bun --filter backend lint:fix
  format      → bun --filter backend format
  format:check→ bun --filter backend format:check
  test        → bun --filter backend test
  db:migrate  → bun --filter backend db:migrate
  db:studio   → bun --filter backend db:studio
  ```

### 2. `.gitignore`
- `node_modules/`, `dist/`, `.env`, `.env.local`
- Prisma: `.prisma/`
- OS files: `.DS_Store`, `Thumbs.db`
- IDE: `.vscode/` (or keep settings — TBD), `.idea/`
- Bun: `bun.lock` (include or exclude — debatable, recommend **include** for reproducible builds)
- Test: `coverage/`

### 3. `docker-compose.yml`
- **PostgreSQL 16 Alpine**
  - Port `5432`
  - Default creds `postgres/postgres`, DB name `movie_app`
  - Named volume `pgdata` for persistence
- **pgAdmin 4**
  - Port `5050` (web UI at `http://localhost:5050`)
  - Default login: `admin@admin.com` / `admin`
  - Auto-registers the PostgreSQL server via `servers.json` mount
  - Named volume `pgadmin_data` for persistence
- **Docker strategy**: Only infrastructure is containerized (DB + admin tools). Application code (backend, frontend) runs natively with Bun for fast DX — no volume mount slowness on macOS, native `--watch`, direct `bunx prisma` access.

### 4. `.env.example`
- All backend env vars with placeholder values
- Comments explaining each variable

### 5. `backend/package.json`
- `"name": "backend"`, private
- Scripts:
  ```
  dev        → bun run --watch src/index.ts
  build      → tsc
  start      → bun dist/index.js
  lint       → eslint src/
  lint:fix   → eslint src/ --fix
  format     → prettier --write "src/**/*.ts"
  format:check → prettier --check "src/**/*.ts"
  test       → vitest run
  test:watch → vitest
  test:coverage → vitest run --coverage
  db:migrate → bunx prisma migrate dev
  db:generate→ bunx prisma generate
  db:studio  → bunx prisma studio
  ```
- **Production dependencies:**
  - `fastify`, `@fastify/cors`
  - `@apollo/server`, `@as-integrations/fastify`
  - `graphql`, `graphql-tag`
  - `@prisma/client`
  - `@sentry/node`
  - `jwks-rsa`, `fast-jwt`
  - `node-cache`
- **Dev dependencies:**
  - `typescript`, `@types/node`
  - `prisma`
  - `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`
  - `prettier`
  - `vitest`, `@vitest/coverage-v8`

### 6. `backend/tsconfig.json`
- Target: `ES2022` (Node 22 supports it fully)
- Module: `NodeNext` / `moduleResolution: NodeNext`
- Strict mode enabled
- `outDir: dist`, `rootDir: src`
- Include: `src/**/*`
- Exclude: `node_modules`, `dist`, `**/*.test.ts`

### 7. `backend/eslint.config.mjs` (flat config — ESLint 9+)
- `@eslint/js` recommended rules
- `typescript-eslint` strict + stylistic presets
- `eslint-config-prettier` to disable formatting rules (Prettier handles those)
- Ignore patterns: `dist/`, `node_modules/`, `prisma/`

### 8. `backend/.prettierrc`
- `semi: true`
- `singleQuote: true`
- `trailingComma: "all"`
- `printWidth: 100`
- `tabWidth: 2`

### 9. `backend/.prettierignore`
- `dist/`, `node_modules/`, `prisma/migrations/`

### 10. `backend/vitest.config.ts`
- Test files: `src/**/*.test.ts`
- Coverage provider: `v8`
- Environment: `node`
- Globals: false (explicit imports from `vitest`)

---

## Decisions made

| Choice | Decision | Why |
|--------|----------|-----|
| Test runner | **Vitest** | Mature mocking (`vi.mock`), great TS support, coverage built-in, large ecosystem. Bun test is viable but Vitest's mocking and watch mode are more polished today. |
| ESLint version | **9+ flat config** | New standard, simpler config, no `.eslintrc` needed |
| Prettier integration | **eslint-config-prettier** (disable rules only) | No `eslint-plugin-prettier` — Prettier runs separately, avoids slow lint runs |
| Lock file | **Commit `bun.lock`** | Reproducible installs across machines |
| Test DB strategy | Decided in a later plan (Phase 2: Database) | Keeps this plan focused on tooling only |
| Docker strategy | **Infrastructure only** (Postgres + pgAdmin) | Backend/frontend run natively with Bun for fast DX. Dockerfiles for app code added later for deployment/CI. |

---

## Execution order

1. Create root `package.json`
2. Create `.gitignore`
3. Create `docker-compose.yml`
4. Create `.env.example`
5. Create `backend/package.json`
6. Run `bun install` (installs all deps, generates lock file)
7. Create `backend/tsconfig.json`
8. Create `backend/eslint.config.mjs`
9. Create `backend/.prettierrc` + `.prettierignore`
10. Create `backend/vitest.config.ts`
11. Create a dummy `backend/src/index.ts` (e.g. `console.log('hello')`) so we can verify:
    - `bun run build` compiles
    - `bun run lint` passes
    - `bun run format:check` passes
    - `bun run test` runs (no tests yet, exits cleanly)
12. Commit: "chore: project scaffolding — tooling, linting, testing setup"

---

## Verification checklist

- [ ] `bun install` succeeds, `bun.lock` generated
- [ ] `bun run build` compiles `src/index.ts` → `dist/index.js`
- [ ] `bun run lint` reports no errors
- [ ] `bun run format:check` reports no issues
- [ ] `bun run test` exits cleanly (0 tests, 0 failures)
- [ ] `docker compose up -d` starts PostgreSQL (can connect on 5432)
- [ ] pgAdmin accessible at `http://localhost:5050`, Postgres server auto-registered
- [ ] Root scripts proxy correctly (`bun run lint` at root runs backend lint)
