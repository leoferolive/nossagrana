import {
  orcamentoCategoriaParamsSchema,
  orcamentoQuerySchema,
  orcamentoSetRequestSchema,
} from '@nossagrana/types';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleReferenciaOwnershipRepository } from '../../shared/referencia-ownership/referencia-ownership.repository.js';
import {
  repositoriosInMemoryDe,
  validadorReferenciasInMemory,
} from '../../shared/repositorios-in-memory.js';
import { ReferenciaOwnershipValidator } from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import { DrizzleOrcamentoRepository, InMemoryOrcamentoRepository } from './orcamento.repository.js';
import {
  orcamentoHistoricoSchema,
  orcamentoListSchema,
  orcamentoSetSchema,
} from './orcamento.schema.js';
import { OrcamentoService } from './orcamento.service.js';

function getCurrentMes(): string {
  const now = new Date();
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const ano = partes.find((p) => p.type === 'year')!.value;
  const mes = partes.find((p) => p.type === 'month')!.value;
  return `${ano}-${mes}`;
}

const defaultService = (fastify: FastifyInstance) => {
  if (env.NODE_ENV === 'test') {
    return new OrcamentoService(
      new InMemoryOrcamentoRepository(),
      validadorReferenciasInMemory(repositoriosInMemoryDe(fastify)),
    );
  }
  return new OrcamentoService(
    new DrizzleOrcamentoRepository(),
    new ReferenciaOwnershipValidator(new DrizzleReferenciaOwnershipRepository()),
  );
};

export const orcamentoRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService(fastify);

  fastify.get(
    '/orcamento',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: orcamentoListSchema,
    },
    async (request) => {
      const { mesReferencia: qMes } = orcamentoQuerySchema.parse(request.query);
      return service.list(request.familiaIdAtiva as string, qMes ?? getCurrentMes());
    },
  );

  fastify.post(
    '/orcamento/:categoriaId',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: orcamentoSetSchema },
    async (request, reply) => {
      const { categoriaId } = orcamentoCategoriaParamsSchema.parse(request.params);
      const { valorLimite, vigenciaInicio } = orcamentoSetRequestSchema.parse(request.body);
      await service.set({
        familiaId: request.familiaIdAtiva as string,
        categoriaId,
        usuarioId: request.user.sub,
        valorLimite,
        vigenciaInicio,
      });
      const historico = await service.historico(request.familiaIdAtiva as string, categoriaId);
      return reply.code(200).send({ orcamento: historico.historico[0] });
    },
  );

  fastify.get(
    '/orcamento/:categoriaId/historico',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: orcamentoHistoricoSchema,
    },
    async (request) => {
      const { categoriaId } = orcamentoCategoriaParamsSchema.parse(request.params);
      return service.historico(request.familiaIdAtiva as string, categoriaId);
    },
  );
};
