import {
  metodoPagamentoCreateRequestSchema,
  metodoPagamentoParamsSchema,
  metodoPagamentoUpdateRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import {
  DrizzleMetodoPagamentoRepository,
  InMemoryMetodoPagamentoRepository,
} from './metodo-pagamento.repository.js';
import {
  metodoPagamentoCreateSchema,
  metodoPagamentoDeleteSchema,
  metodoPagamentoListSchema,
  metodoPagamentoUpdateSchema,
} from './metodo-pagamento.schema.js';
import {
  MetodoPagamentoNotFoundError,
  MetodoPagamentoService,
} from './metodo-pagamento.service.js';

const defaultService = (): MetodoPagamentoService => {
  if (env.NODE_ENV === 'test') {
    return new MetodoPagamentoService(new InMemoryMetodoPagamentoRepository());
  }
  return new MetodoPagamentoService(new DrizzleMetodoPagamentoRepository());
};

export const metodoPagamentoRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService();

  fastify.get(
    '/metodos-pagamento',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: metodoPagamentoListSchema },
    async (request, reply) => {
      const metodos = await service.listByFamiliaId({
        familiaId: request.familiaIdAtiva as string,
      });
      return reply.code(200).send({
        metodosPagamento: metodos.map((m) => ({ ...m, criadoEm: m.criadoEm.toISOString() })),
      });
    },
  );

  fastify.post(
    '/metodos-pagamento',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: metodoPagamentoCreateSchema },
    async (request, reply) => {
      const payload = metodoPagamentoCreateRequestSchema.parse(request.body);
      const metodo = await service.create({
        familiaId: request.familiaIdAtiva as string,
        nome: payload.nome,
        tipo: payload.tipo,
        dataFechamento: payload.dataFechamento ?? null,
        dataVencimento: payload.dataVencimento ?? null,
        usuarioDonoId: request.user.sub,
      });
      return reply.code(201).send({
        metodoPagamento: { ...metodo, criadoEm: metodo.criadoEm.toISOString() },
      });
    },
  );

  fastify.patch(
    '/metodos-pagamento/:id',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: metodoPagamentoUpdateSchema },
    async (request, reply) => {
      try {
        const { id } = metodoPagamentoParamsSchema.parse(request.params);
        const payload = metodoPagamentoUpdateRequestSchema.parse(request.body);
        const metodo = await service.update({
          id,
          familiaId: request.familiaIdAtiva as string,
          nome: payload.nome,
          tipo: payload.tipo,
          dataFechamento: payload.dataFechamento ?? null,
          dataVencimento: payload.dataVencimento ?? null,
        });
        return reply.code(200).send({
          metodoPagamento: { ...metodo, criadoEm: metodo.criadoEm.toISOString() },
        });
      } catch (error) {
        if (error instanceof MetodoPagamentoNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  fastify.delete(
    '/metodos-pagamento/:id',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: metodoPagamentoDeleteSchema },
    async (request, reply) => {
      try {
        const { id } = metodoPagamentoParamsSchema.parse(request.params);
        const metodo = await service.deactivate({
          id,
          familiaId: request.familiaIdAtiva as string,
        });
        return reply.code(200).send({
          metodoPagamento: { ...metodo, criadoEm: metodo.criadoEm.toISOString() },
        });
      } catch (error) {
        if (error instanceof MetodoPagamentoNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );
};
