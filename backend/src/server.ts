import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ApolloServer } from '@apollo/server';
import fastifyApollo, { fastifyApolloDrainPlugin } from '@as-integrations/fastify';
import { env } from './config/env.js';
import { typeDefs, resolvers } from './graphql/schema/index.js';
import { logger } from './utils/logger.js';

export async function buildServer(opts?: { logger?: boolean }) {
  const app = Fastify({ logger: opts?.logger ?? true });

  await app.register(cors, { origin: env.FRONTEND_URL });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Apollo Server
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [fastifyApolloDrainPlugin(app)],
    introspection: true,
    formatError: (formattedError, error) => {
      logger.error('GraphQL Error', error);

      if (process.env['NODE_ENV'] === 'production') {
        return {
          message: formattedError.message,
          extensions: {
            code: formattedError.extensions?.['code'] || 'INTERNAL_SERVER_ERROR',
          },
        };
      }

      return formattedError;
    },
  });

  await apollo.start();
  await app.register(fastifyApollo(apollo));

  return app;
}
