import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { env } from './config/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { categoriaRoutes } from './modules/categoria/categoria.routes.js';
import { familiaRoutes } from './modules/familia/familia.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { metodoPagamentoRoutes } from './modules/metodo-pagamento/metodo-pagamento.routes.js';
import { transacaoRoutes } from './modules/transacao/transacao.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { orcamentoRoutes } from './modules/orcamento/orcamento.routes.js';
import { relatorioRoutes } from './modules/relatorio/relatorio.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { historicoRoutes } from './modules/historico/historico.routes.js';
import { wsRoutes } from './modules/ws/ws.routes.js';
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
  app.register(metodoPagamentoRoutes, { prefix: '/api' });
  app.register(transacaoRoutes, { prefix: '/api' });
  app.register(dashboardRoutes, { prefix: '/api' });
  app.register(orcamentoRoutes, { prefix: '/api' });
  app.register(relatorioRoutes, { prefix: '/api' });
  app.register(historicoRoutes, { prefix: '/api' });
  app.register(adminRoutes, { prefix: '/api' });
  app.register(wsRoutes, { prefix: '/api' });

  return app;
};
