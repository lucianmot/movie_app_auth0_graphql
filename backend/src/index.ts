import './config/instrument.js';
import { env } from './config/env.js';
import { buildServer } from './server.js';
import { logger } from './utils/logger.js';
import prisma from './config/database.js';

async function main() {
  const server = await buildServer();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    await server.close();
    await prisma.$disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await server.listen({ port: env.BACKEND_PORT, host: '0.0.0.0' });
  logger.info(`Server listening on port ${env.BACKEND_PORT}`);
}

main().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
