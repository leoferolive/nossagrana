import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { categoriaRoutes } from './modules/categoria/categoria.routes.js';
import { familiaRoutes } from './modules/familia/familia.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { familiaScopePlugin } from './plugins/familia-scope.plugin.js';
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
  app.register(familiaScopePlugin);
  app.register(websocketPlugin);

  app.register(authRoutes, { prefix: '/api' });
  app.register(categoriaRoutes, { prefix: '/api' });
  app.register(familiaRoutes, { prefix: '/api' });
  app.register(healthRoutes, { prefix: '/api' });

  return app;
};
