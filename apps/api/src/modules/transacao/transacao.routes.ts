import {
  transacaoCreateRequestSchema,
  transacaoListQuerySchema,
  transacaoParamsSchema,
  transacaoUpdateRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import {
  DrizzleMetodoPagamentoRepository,
  InMemoryMetodoPagamentoRepository,
} from '../metodo-pagamento/metodo-pagamento.repository.js';
import type { MetodoPagamentoRepository } from '../metodo-pagamento/metodo-pagamento.types.js';
import {
  transacaoCreateSchema,
  transacaoDeleteSchema,
  transacaoGetSchema,
  transacaoListSchema,
  transacaoUpdateSchema,
} from './transacao.schema.js';
import {
  DrizzleTransacaoRepository,
  InMemoryTransacaoRepository,
} from './transacao.repository.js';
import type { Transacao } from './transacao.types.js';
import { TransacaoNotFoundError, TransacaoService } from './transacao.service.js';

async function resolveMetodoPagamento(
  metodoPagamentoId: string | null | undefined,
  metodoPagamentoRepository: MetodoPagamentoRepository,
  familiaId: string,
) {
  if (!metodoPagamentoId) return { tipo: null, dataFechamento: null };

  const metodos = await metodoPagamentoRepository.listByFamiliaId({ familiaId });
  const metodo = metodos.find((m) => m.id === metodoPagamentoId);

  if (!metodo) return { tipo: null, dataFechamento: null };
  return { tipo: metodo.tipo, dataFechamento: metodo.dataFechamento };
}

const defaultServices = () => {
  if (env.NODE_ENV === 'test') {
    return {
      transacaoService: new TransacaoService(new InMemoryTransacaoRepository()),
      metodoPagamentoRepository: new InMemoryMetodoPagamentoRepository() as MetodoPagamentoRepository,
    };
  }
  return {
    transacaoService: new TransacaoService(new DrizzleTransacaoRepository()),
    metodoPagamentoRepository: new DrizzleMetodoPagamentoRepository() as MetodoPagamentoRepository,
  };
};

const mapTransacao = (t: Transacao) => ({
  ...t,
  criadoEm: t.criadoEm.toISOString(),
  atualizadoEm: t.atualizadoEm.toISOString(),
});

export const transacaoRoutes: FastifyPluginAsync = async (fastify) => {
  const { transacaoService, metodoPagamentoRepository } = defaultServices();

  fastify.post(
    '/transacoes',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: transacaoCreateSchema,
    },
    async (request, reply) => {
      const payload = transacaoCreateRequestSchema.parse(request.body);
      const familiaId = request.familiaIdAtiva as string;

      const { tipo: mpTipo, dataFechamento } = await resolveMetodoPagamento(
        payload.metodoPagamentoId,
        metodoPagamentoRepository,
        familiaId,
      );

      const transacao = await transacaoService.registrar({
        familiaId,
        tipo: payload.tipo,
        valor: payload.valor,
        categoriaId: payload.categoriaId,
        descricao: payload.descricao ?? null,
        data: payload.data,
        metodoPagamentoId: payload.metodoPagamentoId ?? null,
        metodoPagamentoTipo: mpTipo,
        dataFechamento,
        usuarioRegistrouId: request.user.sub,
        parcelado: payload.parcelado,
        numeroParcelas: payload.numeroParcelas ?? undefined,
        recorrente: payload.recorrente,
        frequencia: payload.frequencia ?? null,
        dataFimRecorrencia: payload.dataFimRecorrencia ?? null,
      });

      return reply.code(201).send({ transacao: mapTransacao(transacao) });
    },
  );

  fastify.get(
    '/transacoes',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: transacaoListSchema,
    },
    async (request, reply) => {
      const query = transacaoListQuerySchema.parse(request.query);
      const familiaId = request.familiaIdAtiva as string;

      const transacoes = await transacaoService.listar({
        familiaId,
        mesReferencia: query.mesReferencia,
        tipo: query.tipo,
        categoriaId: query.categoriaId,
        usuarioRegistrouId: query.usuarioRegistrouId,
        metodoPagamentoId: query.metodoPagamentoId,
      });

      return reply.code(200).send({
        transacoes: transacoes.map(mapTransacao),
      });
    },
  );

  fastify.get(
    '/transacoes/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: transacaoGetSchema,
    },
    async (request, reply) => {
      try {
        const { id } = transacaoParamsSchema.parse(request.params);
        const transacao = await transacaoService.detalhe({
          id,
          familiaId: request.familiaIdAtiva as string,
        });
        return reply.code(200).send({ transacao: mapTransacao(transacao) });
      } catch (error) {
        if (error instanceof TransacaoNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  fastify.patch(
    '/transacoes/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: transacaoUpdateSchema,
    },
    async (request, reply) => {
      try {
        const { id } = transacaoParamsSchema.parse(request.params);
        const payload = transacaoUpdateRequestSchema.parse(request.body);
        const familiaId = request.familiaIdAtiva as string;

        const { tipo: mpTipo, dataFechamento } = await resolveMetodoPagamento(
          payload.metodoPagamentoId,
          metodoPagamentoRepository,
          familiaId,
        );

        const transacao = await transacaoService.editar({
          id,
          familiaId,
          tipo: payload.tipo,
          valor: payload.valor,
          categoriaId: payload.categoriaId,
          descricao: payload.descricao ?? null,
          data: payload.data,
          metodoPagamentoId: payload.metodoPagamentoId ?? null,
          metodoPagamentoTipo: mpTipo,
          dataFechamento,
        });

        return reply.code(200).send({ transacao: mapTransacao(transacao) });
      } catch (error) {
        if (error instanceof TransacaoNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  fastify.delete(
    '/transacoes/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: transacaoDeleteSchema,
    },
    async (request, reply) => {
      try {
        const { id } = transacaoParamsSchema.parse(request.params);
        await transacaoService.excluir({
          id,
          familiaId: request.familiaIdAtiva as string,
        });
        return reply.code(204).send(null);
      } catch (error) {
        if (error instanceof TransacaoNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );
};
