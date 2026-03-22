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
import { and, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { categorias, transacoes } from '../../db/schema.js';
import { DrizzleCofrinhoRepository, InMemoryCofrinhoRepository } from './cofrinho.repository.js';
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
import {
  AporteRecorrenteJaAtivoError,
  AporteRecorrenteNotFoundError,
  CofrinhoEncerradoError,
  CofrinhoNotFoundError,
  CofrinhoService,
  SaldoInsuficienteError,
} from './cofrinho.service.js';
import type { Cofrinho, MovimentacaoCofrinho, TransacaoCreator } from './cofrinho.types.js';

const serializeCofrinho = (c: Cofrinho) => ({
  ...c,
  criadoEm: c.criadoEm.toISOString(),
  encerradoEm: c.encerradoEm?.toISOString() ?? null,
});

const serializeMovimentacao = (m: MovimentacaoCofrinho) => ({
  ...m,
  registradoEm: m.registradoEm.toISOString(),
});

const testTransacaoCreator: TransacaoCreator = {
  criar: async () => ({ id: randomUUID() }),
};

const testGetCategoriaCofrinho = async () => ({ id: randomUUID() });

const realTransacaoCreator: TransacaoCreator = {
  criar: async (input) => {
    const [row] = await db
      .insert(transacoes)
      .values({
        familiaId: input.familiaId,
        tipo: input.tipo,
        valor: input.valor,
        categoriaId: input.categoriaId,
        descricao: input.descricao,
        data: input.data,
        mesReferencia: input.mesReferencia,
        usuarioRegistrouId: input.usuarioRegistrouId,
        cofrinhoId: input.cofrinhoId,
      })
      .returning({ id: transacoes.id });
    return { id: row.id };
  },
};

const realGetCategoriaCofrinho = async (familiaId: string) => {
  const [cat] = await db
    .select({ id: categorias.id })
    .from(categorias)
    .where(
      and(
        eq(categorias.familiaId, familiaId),
        eq(categorias.nome, 'Cofrinho'),
        eq(categorias.sistema, true),
      ),
    );
  if (!cat) throw new Error('Categoria Cofrinho não encontrada');
  return cat;
};

const defaultCofrinhoService = (): CofrinhoService => {
  if (env.NODE_ENV === 'test') {
    return new CofrinhoService(
      new InMemoryCofrinhoRepository(),
      testTransacaoCreator,
      testGetCategoriaCofrinho,
    );
  }

  return new CofrinhoService(
    new DrizzleCofrinhoRepository(),
    realTransacaoCreator,
    realGetCategoriaCofrinho,
  );
};

function handleCofrinhoError(
  error: unknown,
  reply: import('fastify').FastifyReply,
): import('fastify').FastifyReply | undefined {
  if (error instanceof CofrinhoNotFoundError) {
    return reply.code(404).send({ message: error.message });
  }
  if (error instanceof CofrinhoEncerradoError) {
    return reply.code(400).send({ message: error.message });
  }
  if (error instanceof SaldoInsuficienteError) {
    return reply.code(400).send({ message: error.message });
  }
  if (error instanceof AporteRecorrenteJaAtivoError) {
    return reply.code(409).send({ message: error.message });
  }
  if (error instanceof AporteRecorrenteNotFoundError) {
    return reply.code(404).send({ message: error.message });
  }
  return undefined;
}

export const cofrinhoRoutes: FastifyPluginAsync = async (fastify) => {
  const cofrinhoService = defaultCofrinhoService();

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
