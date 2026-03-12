import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { env } from './config/env.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { websocketPlugin } from './plugins/websocket.plugin.js';

export const buildApp = () => {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(import('@fastify/cors'), {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  app.register(authPlugin);
  app.register(websocketPlugin);

  app.register(healthRoutes, { prefix: '/api' });

  return app;
};
