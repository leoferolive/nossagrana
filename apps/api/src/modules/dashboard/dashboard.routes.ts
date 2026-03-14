import { dashboardQuerySchema } from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import {
  DrizzleDashboardRepository,
  InMemoryDashboardRepository,
} from './dashboard.repository.js';
import {
  dashboardGraficosSchema,
  dashboardOrcamentoSchema,
  dashboardResumoSchema,
} from './dashboard.schema.js';
import { DashboardService } from './dashboard.service.js';

const defaultService = () => {
  const repo =
    env.NODE_ENV === 'test'
      ? new InMemoryDashboardRepository()
      : new DrizzleDashboardRepository();
  return new DashboardService(repo);
};

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService();

  fastify.get(
    '/dashboard',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: dashboardResumoSchema },
    async (request) => {
      const { mesReferencia: qMes } = dashboardQuerySchema.parse(request.query);
      const mes = qMes ?? service.getMesReferenciaAtual();
      return service.getResumo(request.familiaIdAtiva as string, mes);
    },
  );

  fastify.get(
    '/dashboard/graficos',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: dashboardGraficosSchema },
    async (request) => {
      const { mesReferencia: qMes } = dashboardQuerySchema.parse(request.query);
      const mes = qMes ?? service.getMesReferenciaAtual();
      return service.getGraficos(request.familiaIdAtiva as string, mes);
    },
  );

  fastify.get(
    '/dashboard/orcamento',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: dashboardOrcamentoSchema },
    async (request) => {
      const { mesReferencia: qMes } = dashboardQuerySchema.parse(request.query);
      const mes = qMes ?? service.getMesReferenciaAtual();
      return service.getOrcamento(request.familiaIdAtiva as string, mes);
    },
  );
};
