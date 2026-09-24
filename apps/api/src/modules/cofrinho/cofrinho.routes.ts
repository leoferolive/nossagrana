import { randomUUID } from 'node:crypto';

import {
  cofrinhoAporteRequestSchema,
  cofrinhoCreateRequestSchema,
  cofrinhoEncerrarRequestSchema,
  cofrinhoListQuerySchema,
  cofrinhoParamsSchema,
  cofrinhoRetiradaRequestSchema,
  cofrinhoUpdateRequestSchema,
} from '@nossagrana/types';
import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { repositoriosInMemoryDe } from '../../shared/repositorios-in-memory.js';
import { ConflitoDeConcorrenciaError } from '../../shared/unit-of-work/conflito-concorrencia.js';
import { responderConflitoDeConcorrencia } from '../../shared/unit-of-work/conflito-concorrencia.http.js';
import { criarBuscaCategoriaCofrinho } from './cofrinho.categoria.js';
import {
  AporteRecorrenteIndisponivelError,
  AporteRecorrenteJaAtivoError,
  AporteRecorrenteNotFoundError,
  CancelamentoRecorrenteIndisponivelError,
  CofrinhoEncerradoError,
  CofrinhoNotFoundError,
  SaldoInsuficienteError,
} from './cofrinho.errors.js';
import {
  cofrinhoAporteRecorrenteDeleteSchema,
  cofrinhoAporteSchema,
  cofrinhoCreateSchema,
  cofrinhoDetalheSchema,
  cofrinhoEncerrarSchema,
  cofrinhoListSchema,
  cofrinhoRetiradaSchema,
  cofrinhoUpdateSchema,
} from './cofrinho.schema.js';
import { CofrinhoService } from './cofrinho.service.js';
import type { Cofrinho, MovimentacaoCofrinho } from './cofrinho.types.js';
import {
  criarRepositoriosCofrinhoDrizzle,
  criarUnitOfWorkCofrinhoDrizzle,
  criarUnitOfWorkCofrinhoInMemory,
} from './cofrinho.unit-of-work.js';

const serializeCofrinho = (c: Cofrinho) => ({
  ...c,
  criadoEm: c.criadoEm.toISOString(),
  encerradoEm: c.encerradoEm?.toISOString() ?? null,
});

const serializeMovimentacao = (m: MovimentacaoCofrinho) => ({
  ...m,
  registradoEm: m.registradoEm.toISOString(),
});

const testGetCategoriaCofrinho = async () => ({ id: randomUUID() });

/**
 * test: InMemory compartilhado da app (a transação do aporte aparece em
 * /transacoes). Produção: aporte/retirada/encerramento num `db.transaction`
 * (#59), com cofrinho, ledger e transação sobre o mesmo `tx`.
 */
function criarCofrinhoServicePadrao(fastify: FastifyInstance): CofrinhoService {
  if (env.NODE_ENV === 'test') {
    const repositorios = repositoriosInMemoryDe(fastify);
    const participantes = {
      cofrinhos: repositorios.cofrinhos,
      movimentacoes: repositorios.movimentacoesCofrinho,
      transacoes: repositorios.transacoes,
    };
    const uow = criarUnitOfWorkCofrinhoInMemory(participantes);
    return new CofrinhoService(participantes, uow, testGetCategoriaCofrinho);
  }
  /* v8 ignore next 5 -- wiring de produção exige banco real (coberto pelos testes *.pg.test.ts) */
  return new CofrinhoService(
    criarRepositoriosCofrinhoDrizzle(db),
    criarUnitOfWorkCofrinhoDrizzle(db),
    criarBuscaCategoriaCofrinho(db),
  );
}

type ErroDeCofrinho = abstract new (...args: never[]) => Error;

/** Erro de domínio → status HTTP (envelope `{ message }` já usado pelo módulo). */
const STATUS_POR_ERRO: Array<[ErroDeCofrinho, number]> = [
  [CofrinhoNotFoundError, 404],
  [CofrinhoEncerradoError, 400],
  [SaldoInsuficienteError, 400],
  [AporteRecorrenteIndisponivelError, 400],
  [CancelamentoRecorrenteIndisponivelError, 400],
  [AporteRecorrenteJaAtivoError, 409],
  [AporteRecorrenteNotFoundError, 404],
];

function handleCofrinhoError(error: unknown, reply: FastifyReply): FastifyReply | undefined {
  if (error instanceof ConflitoDeConcorrenciaError) {
    return responderConflitoDeConcorrencia(error, reply.request, reply);
  }
  const par = STATUS_POR_ERRO.find(([Classe]) => error instanceof Classe);
  if (!par || !(error instanceof Error)) return undefined;
  return reply.code(par[1]).send({ message: error.message });
}

export const cofrinhoRoutes: FastifyPluginAsync = async (fastify) => {
  const cofrinhoService = criarCofrinhoServicePadrao(fastify);

  // POST /cofrinhos — criar cofrinho
  fastify.post(
    '/cofrinhos',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: cofrinhoCreateSchema,
    },
    async (request, reply) => {
      const payload = cofrinhoCreateRequestSchema.parse(request.body);
      const cofrinho = await cofrinhoService.criar({
        familiaId: request.familiaIdAtiva as string,
        nome: payload.nome,
        emoji: payload.emoji ?? null,
        descricao: payload.descricao ?? null,
        metaValor: payload.metaValor ?? null,
        criadoPor: request.user.sub,
      });

      return reply.code(201).send({
        cofrinho: serializeCofrinho(cofrinho),
      });
    },
  );

  // GET /cofrinhos — listar cofrinhos
  fastify.get(
    '/cofrinhos',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: cofrinhoListSchema,
    },
    async (request, reply) => {
      const query = cofrinhoListQuerySchema.parse(request.query);
      const cofrinhos = await cofrinhoService.listar({
        familiaId: request.familiaIdAtiva as string,
        status: query.status,
      });

      return reply.code(200).send({
        cofrinhos: cofrinhos.map(serializeCofrinho),
      });
    },
  );

  // GET /cofrinhos/:id — detalhe do cofrinho
  fastify.get(
    '/cofrinhos/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: cofrinhoDetalheSchema,
    },
    async (request, reply) => {
      try {
        const params = cofrinhoParamsSchema.parse(request.params);
        const { cofrinho, movimentacoes, aporteRecorrenteAtivo } = await cofrinhoService.detalhe({
          id: params.id,
          familiaId: request.familiaIdAtiva as string,
        });

        return reply.code(200).send({
          cofrinho: serializeCofrinho(cofrinho),
          movimentacoes: movimentacoes.map(serializeMovimentacao),
          aporteRecorrenteAtivo,
        });
      } catch (error) {
        const handled = handleCofrinhoError(error, reply);
        if (handled) return handled;
        throw error;
      }
    },
  );

  // PATCH /cofrinhos/:id — editar cofrinho
  fastify.patch(
    '/cofrinhos/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: cofrinhoUpdateSchema,
    },
    async (request, reply) => {
      try {
        const params = cofrinhoParamsSchema.parse(request.params);
        const payload = cofrinhoUpdateRequestSchema.parse(request.body);
        const cofrinho = await cofrinhoService.editar({
          id: params.id,
          familiaId: request.familiaIdAtiva as string,
          nome: payload.nome,
          emoji: payload.emoji,
          descricao: payload.descricao,
          metaValor: payload.metaValor,
        });

        return reply.code(200).send({
          cofrinho: serializeCofrinho(cofrinho),
        });
      } catch (error) {
        const handled = handleCofrinhoError(error, reply);
        if (handled) return handled;
        throw error;
      }
    },
  );

  // POST /cofrinhos/:id/aportes — aporte
  fastify.post(
    '/cofrinhos/:id/aportes',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: cofrinhoAporteSchema,
    },
    async (request, reply) => {
      try {
        const params = cofrinhoParamsSchema.parse(request.params);
        const payload = cofrinhoAporteRequestSchema.parse(request.body);
        const { cofrinho, movimentacao } = await cofrinhoService.aportar({
          cofrinhoId: params.id,
          familiaId: request.familiaIdAtiva as string,
          valor: payload.valor,
          descricao: payload.descricao ?? null,
          registradoPor: request.user.sub,
          recorrente: payload.recorrente,
          frequencia: payload.frequencia ?? null,
          dataFimRecorrencia: payload.dataFimRecorrencia ?? null,
        });

        return reply.code(201).send({
          cofrinho: serializeCofrinho(cofrinho),
          movimentacao: serializeMovimentacao(movimentacao),
        });
      } catch (error) {
        const handled = handleCofrinhoError(error, reply);
        if (handled) return handled;
        throw error;
      }
    },
  );

  // POST /cofrinhos/:id/retiradas — retirada
  fastify.post(
    '/cofrinhos/:id/retiradas',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: cofrinhoRetiradaSchema,
    },
    async (request, reply) => {
      try {
        const params = cofrinhoParamsSchema.parse(request.params);
        const payload = cofrinhoRetiradaRequestSchema.parse(request.body);
        const { cofrinho, movimentacao } = await cofrinhoService.retirar({
          cofrinhoId: params.id,
          familiaId: request.familiaIdAtiva as string,
          valor: payload.valor,
          descricao: payload.descricao ?? null,
          voltarAoSaldo: payload.voltarAoSaldo,
          registradoPor: request.user.sub,
        });

        return reply.code(201).send({
          cofrinho: serializeCofrinho(cofrinho),
          movimentacao: serializeMovimentacao(movimentacao),
        });
      } catch (error) {
        const handled = handleCofrinhoError(error, reply);
        if (handled) return handled;
        throw error;
      }
    },
  );

  // POST /cofrinhos/:id/encerrar — encerrar cofrinho
  fastify.post(
    '/cofrinhos/:id/encerrar',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: cofrinhoEncerrarSchema,
    },
    async (request, reply) => {
      try {
        const params = cofrinhoParamsSchema.parse(request.params);
        const payload = cofrinhoEncerrarRequestSchema.parse(request.body);
        const cofrinho = await cofrinhoService.encerrar({
          id: params.id,
          familiaId: request.familiaIdAtiva as string,
          voltarAoSaldo: payload.voltarAoSaldo,
          registradoPor: request.user.sub,
        });

        return reply.code(200).send({
          cofrinho: serializeCofrinho(cofrinho),
        });
      } catch (error) {
        const handled = handleCofrinhoError(error, reply);
        if (handled) return handled;
        throw error;
      }
    },
  );

  // DELETE /cofrinhos/:id/aporte-recorrente — cancelar aporte recorrente
  fastify.delete(
    '/cofrinhos/:id/aporte-recorrente',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: cofrinhoAporteRecorrenteDeleteSchema,
    },
    async (request, reply) => {
      try {
        const params = cofrinhoParamsSchema.parse(request.params);
        await cofrinhoService.cancelarAporteRecorrente({
          cofrinhoId: params.id,
          familiaId: request.familiaIdAtiva as string,
        });

        return reply.code(204).send();
      } catch (error) {
        const handled = handleCofrinhoError(error, reply);
        if (handled) return handled;
        throw error;
      }
    },
  );
};
