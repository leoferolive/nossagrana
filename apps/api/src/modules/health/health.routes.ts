import type { FastifyPluginAsync } from 'fastify';

import { healthSchema } from './health.schema.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', { schema: healthSchema }, async () => {
    return {
      status: 'ok',
      app: 'api',
      timestamp: new Date().toISOString(),
    };
  });
};
