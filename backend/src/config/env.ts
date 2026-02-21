function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Database
  DATABASE_URL: requireEnv('DATABASE_URL'),

  // Auth0
  AUTH0_DOMAIN: requireEnv('AUTH0_DOMAIN'),
  AUTH0_AUDIENCE: requireEnv('AUTH0_AUDIENCE'),

  // TMDB
  TMDB_API_KEY: requireEnv('TMDB_API_KEY'),

  // Sentry
  SENTRY_DSN: optionalEnv('SENTRY_DSN', ''),

  // Server
  BACKEND_PORT: parseInt(optionalEnv('BACKEND_PORT', '4000'), 10),
  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),
} as const;
