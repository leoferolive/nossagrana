import {
  transacaoCreateRequestSchema,
  transacaoListQuerySchema,
  transacaoParamsSchema,
  transacaoUpdateRequestSchema,
} from '@nossagrana/types';
// transacaoAnteciparRequestSchema is imported from schema.ts re-export
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import type { ExecutorDrizzle } from '../../db/executor.types.js';
import {
  DrizzleHistoricoRepository,
  InMemoryHistoricoRepository,
} from '../historico/historico.repository.js';
import { SnapshotService } from '../historico/snapshot.service.js';
import { DrizzleMetodoPagamentoRepository } from '../metodo-pagamento/metodo-pagamento.repository.js';
import type { MetodoPagamentoRepository } from '../metodo-pagamento/metodo-pagamento.types.js';
import { DrizzleReferenciaOwnershipRepository } from '../../shared/referencia-ownership/referencia-ownership.repository.js';
import {
  repositoriosInMemoryDe,
  validadorReferenciasInMemory,
} from '../../shared/repositorios-in-memory.js';
import { ReferenciaOwnershipValidator } from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import { DrizzleUnitOfWork } from '../../shared/unit-of-work/drizzle-unit-of-work.js';
import { InMemoryUnitOfWork } from '../../shared/unit-of-work/in-memory-unit-of-work.js';
import {
  transacaoAnteciparRequestSchema,
  transacaoAnteciparSchema,
  transacaoCreateSchema,
  transacaoDeleteSchema,
  transacaoGetSchema,
  transacaoListSchema,
  transacaoUpdateSchema,
} from './transacao.schema.js';
import { DrizzleTransacaoRepository } from './transacao.repository.js';
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

const defaultServices = (fastify: FastifyInstance) => {
  if (env.NODE_ENV === 'test') {
    const repositorios = repositoriosInMemoryDe(fastify);
    const { transacoes } = repositorios;
    return {
      transacaoService: new TransacaoService(
        transacoes,
        validadorReferenciasInMemory(repositorios),
        new InMemoryUnitOfWork({ transacoes }),
        new SnapshotService(new InMemoryHistoricoRepository()),
      ),
      metodoPagamentoRepository: repositorios.metodosPagamento as MetodoPagamentoRepository,
    };
  }
  return {
    transacaoService: new TransacaoService(
      new DrizzleTransacaoRepository(db),
      new ReferenciaOwnershipValidator(new DrizzleReferenciaOwnershipRepository()),
      // Registro composto (pai + filhas) grava tudo no mesmo `db.transaction` (#78/#85).
      new DrizzleUnitOfWork(db, (tx: ExecutorDrizzle) => ({
        transacoes: new DrizzleTransacaoRepository(tx),
      })),
      new SnapshotService(new DrizzleHistoricoRepository()),
    ),
    metodoPagamentoRepository: new DrizzleMetodoPagamentoRepository() as MetodoPagamentoRepository,
  };
};

const mapTransacao = (t: Transacao) => ({
  ...t,
  criadoEm: t.criadoEm.toISOString(),
  atualizadoEm: t.atualizadoEm.toISOString(),
});

export const transacaoRoutes: FastifyPluginAsync = async (fastify) => {
  const { transacaoService, metodoPagamentoRepository } = defaultServices(fastify);

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

      fastify.eventBus?.emit('transacao:alterada', { familiaId });
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

        fastify.eventBus?.emit('transacao:alterada', { familiaId });
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
        const familiaId = request.familiaIdAtiva as string;
        await transacaoService.excluir({ id, familiaId });
        fastify.eventBus?.emit('transacao:alterada', { familiaId });
        return reply.code(204).send(null);
      } catch (error) {
        if (error instanceof TransacaoNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  fastify.post(
    '/transacoes/:id/antecipar',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: transacaoAnteciparSchema,
    },
    async (request, reply) => {
      try {
        const { id } = transacaoParamsSchema.parse(request.params);
        const payload = transacaoAnteciparRequestSchema.parse(request.body);

        const antecipadas = await transacaoService.anteciparParcelas({
          transacaoPaiId: id,
          familiaId: request.familiaIdAtiva as string,
          novoMesReferencia: payload.novoMesReferencia,
          dataMinima: payload.dataMinima,
        });

        return reply.code(200).send({ antecipadas });
      } catch (error) {
        if (error instanceof TransacaoNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );
};
