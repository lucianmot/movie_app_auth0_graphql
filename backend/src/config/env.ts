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
  get DATABASE_URL() {
    return requireEnv('DATABASE_URL');
  },

  // Auth0
  get AUTH0_DOMAIN() {
    return requireEnv('AUTH0_DOMAIN');
  },
  get AUTH0_AUDIENCE() {
    return requireEnv('AUTH0_AUDIENCE');
  },

  // TMDB
  get TMDB_API_KEY() {
    return requireEnv('TMDB_API_KEY');
  },

  // Sentry
  get SENTRY_DSN() {
    return optionalEnv('SENTRY_DSN', '');
  },

  // Server
  get BACKEND_PORT() {
    return parseInt(optionalEnv('BACKEND_PORT', '4000'), 10);
  },
  get FRONTEND_URL() {
    return optionalEnv('FRONTEND_URL', 'http://localhost:3000');
  },
};
