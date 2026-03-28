/* v8 ignore start -- routes are thin handlers; logic tested via service tests */
import {
  templateTransacaoAplicarRequestSchema,
  templateTransacaoCreateRequestSchema,
  templateTransacaoDeleteParamsSchema,
  templateTransacaoListQuerySchema,
  templateTransacaoReordenarRequestSchema,
  templateTransacaoUpdateParamsSchema,
  templateTransacaoUpdateRequestSchema,
} from '@nossagrana/types';
import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { transacoes } from '../../db/schema.js';
import {
  DrizzleCofrinhoRepository,
  InMemoryCofrinhoRepository,
} from '../cofrinho/cofrinho.repository.js';
import { CofrinhoService } from '../cofrinho/cofrinho.service.js';
import {
  DrizzleTemplateTransacaoRepository,
  InMemoryTemplateTransacaoRepository,
} from './template-transacao.repository.js';
import {
  templateTransacaoAplicarSchema,
  templateTransacaoCreateSchema,
  templateTransacaoDeleteSchema,
  templateTransacaoListSchema,
  templateTransacaoReordenarSchema,
  templateTransacaoUpdateSchema,
} from './template-transacao.schema.js';
import {
  TemplateNotFoundError,
  TemplateTransacaoDuplicateError,
  TemplateTransacaoService,
} from './template-transacao.service.js';

const testTransacaoCreator = {
  criar: async () => ({ id: randomUUID() }),
};

/* v8 ignore start -- production wiring requires real DB */
const realTransacaoCreator = {
  criar: async (input: {
    familiaId: string;
    tipo: 'receita' | 'despesa';
    valor: string;
    categoriaId: string;
    descricao: string | null;
    data: string;
    mesReferencia: string;
    usuarioRegistrouId: string;
    metodoPagamentoId?: string | null;
    cofrinhoId?: string | null;
  }) => {
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
        metodoPagamentoId: input.metodoPagamentoId ?? null,
        cofrinhoId: input.cofrinhoId ?? null,
      })
      .returning({ id: transacoes.id });
    return { id: row.id };
  },
};

const testGetCategoriaCofrinho = async () => ({ id: randomUUID() });

const realGetCategoriaCofrinho = async (familiaId: string) => {
  const { and, eq } = await import('drizzle-orm');
  const { categorias } = await import('../../db/schema.js');
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

/* v8 ignore stop */

const defaultService = (): TemplateTransacaoService => {
  if (env.NODE_ENV === 'test') {
    return new TemplateTransacaoService(
      new InMemoryTemplateTransacaoRepository(),
      testTransacaoCreator,
      new CofrinhoService(
        new InMemoryCofrinhoRepository(),
        testTransacaoCreator,
        testGetCategoriaCofrinho,
      ),
    );
  }

  /* v8 ignore next 8 -- production wiring */
  return new TemplateTransacaoService(
    new DrizzleTemplateTransacaoRepository(),
    realTransacaoCreator,
    new CofrinhoService(
      new DrizzleCofrinhoRepository(),
      realTransacaoCreator,
      realGetCategoriaCofrinho,
    ),
  );
};

export const templateTransacaoRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService();

  fastify.get(
    '/templates-transacao',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoListSchema,
    },
    async (request, reply) => {
      const query = templateTransacaoListQuerySchema.parse(request.query);
      const templates = await service.listByFamiliaId({
        familiaId: request.familiaIdAtiva as string,
        tipo: query.tipo,
      });

      return reply.code(200).send({
        templates: templates.map((t) => ({
          ...t,
          criadoEm: t.criadoEm instanceof Date ? t.criadoEm.toISOString() : t.criadoEm,
          atualizadoEm:
            t.atualizadoEm instanceof Date ? t.atualizadoEm.toISOString() : t.atualizadoEm,
        })),
      });
    },
  );

  fastify.post(
    '/templates-transacao',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoCreateSchema,
    },
    async (request, reply) => {
      try {
        const payload = templateTransacaoCreateRequestSchema.parse(request.body);
        const template = await service.create({
          familiaId: request.familiaIdAtiva as string,
          criadoPor: request.user.sub,
          nome: payload.nome,
          tipo: payload.tipo,
          categoriaId: payload.categoriaId,
          metodoPagamentoId: payload.metodoPagamentoId,
          cofrinhoId: payload.cofrinhoId,
          valorPadrao: payload.valorPadrao,
          ordem: payload.ordem,
        });

        return reply.code(201).send({
          template: {
            ...template,
            criadoEm:
              template.criadoEm instanceof Date
                ? template.criadoEm.toISOString()
                : template.criadoEm,
            atualizadoEm:
              template.atualizadoEm instanceof Date
                ? template.atualizadoEm.toISOString()
                : template.atualizadoEm,
          },
        });
      } catch (error) {
        if (error instanceof TemplateTransacaoDuplicateError) {
          return reply.code(409).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  fastify.patch(
    '/templates-transacao/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoUpdateSchema,
    },
    async (request, reply) => {
      try {
        const params = templateTransacaoUpdateParamsSchema.parse(request.params);
        const payload = templateTransacaoUpdateRequestSchema.parse(request.body);
        const template = await service.update({
          id: params.id,
          familiaId: request.familiaIdAtiva as string,
          nome: payload.nome,
          categoriaId: payload.categoriaId,
          metodoPagamentoId: payload.metodoPagamentoId,
          cofrinhoId: payload.cofrinhoId,
          valorPadrao: payload.valorPadrao,
          ordem: payload.ordem,
        });

        return reply.code(200).send({
          template: {
            ...template,
            criadoEm:
              template.criadoEm instanceof Date
                ? template.criadoEm.toISOString()
                : template.criadoEm,
            atualizadoEm:
              template.atualizadoEm instanceof Date
                ? template.atualizadoEm.toISOString()
                : template.atualizadoEm,
          },
        });
      } catch (error) {
        if (error instanceof TemplateNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  fastify.delete(
    '/templates-transacao/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoDeleteSchema,
    },
    async (request, reply) => {
      try {
        const params = templateTransacaoDeleteParamsSchema.parse(request.params);
        const template = await service.deactivate({
          id: params.id,
          familiaId: request.familiaIdAtiva as string,
        });

        return reply.code(200).send({
          template: {
            ...template,
            criadoEm:
              template.criadoEm instanceof Date
                ? template.criadoEm.toISOString()
                : template.criadoEm,
            atualizadoEm:
              template.atualizadoEm instanceof Date
                ? template.atualizadoEm.toISOString()
                : template.atualizadoEm,
          },
        });
      } catch (error) {
        if (error instanceof TemplateNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  fastify.post(
    '/templates-transacao/aplicar',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoAplicarSchema,
    },
    async (request, reply) => {
      try {
        const payload = templateTransacaoAplicarRequestSchema.parse(request.body);
        const result = await service.aplicar({
          familiaId: request.familiaIdAtiva as string,
          usuarioId: request.user.sub,
          mesReferencia: payload.mesReferencia,
          itens: payload.itens,
        });

        return reply.code(200).send(result);
      } catch (error) {
        if (error instanceof TemplateNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  fastify.patch(
    '/templates-transacao/reordenar',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoReordenarSchema,
    },
    async (request, reply) => {
      const payload = templateTransacaoReordenarRequestSchema.parse(request.body);
      await service.reordenar({
        familiaId: request.familiaIdAtiva as string,
        itens: payload.itens,
      });

      return reply.code(200).send({ ok: true });
    },
  );
};
