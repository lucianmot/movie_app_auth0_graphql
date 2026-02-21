import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildServer({ logger: false });
});

afterAll(async () => {
  await app.close();
});

describe('server', () => {
  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });

    it('should return a valid ISO timestamp', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      const body = JSON.parse(response.body);

      const parsed = new Date(body.timestamp);
      expect(parsed.toISOString()).toBe(body.timestamp);
    });
  });

  describe('POST /graphql', () => {
    it('should respond to the health query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ query: '{ health }' }),
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.data.health).toBe('ok');
    });
  });

  describe('unknown routes', () => {
    it('should return 404 for unknown paths', async () => {
      const response = await app.inject({ method: 'GET', url: '/nonexistent' });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('graceful shutdown', () => {
    it('should close without hanging connections', async () => {
      const server = await buildServer({ logger: false });
      await server.close();
    });
  });
});
