import { historicoMesParamsSchema } from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleHistoricoRepository, InMemoryHistoricoRepository } from './historico.repository.js';
import { historicoDetalheSchema, historicoListSchema } from './historico.schema.js';
import { HistoricoService } from './historico.service.js';

const defaultService = () => {
  const repo =
    env.NODE_ENV === 'test' ? new InMemoryHistoricoRepository() : new DrizzleHistoricoRepository();
  return new HistoricoService(repo);
};

export const historicoRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService();

  fastify.get(
    '/historico',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: historicoListSchema,
    },
    async (request) => {
      return service.list(request.familiaIdAtiva as string);
    },
  );

  fastify.get(
    '/historico/:mesReferencia',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: historicoDetalheSchema,
    },
    async (request, reply) => {
      const { mesReferencia } = historicoMesParamsSchema.parse(request.params);
      const result = await service.detalhe(request.familiaIdAtiva as string, mesReferencia);
      if (result.atual.totalReceitas === '0.00' && result.atual.totalDespesas === '0.00' && !result.snapshot) {
        return reply.code(404).send({ message: 'Mês não encontrado' });
      }
      return result;
    },
  );
};
