import {
  templateTransacaoAplicarRequestSchema,
  templateTransacaoCreateRequestSchema,
  templateTransacaoDeleteParamsSchema,
  templateTransacaoListQuerySchema,
  templateTransacaoReordenarRequestSchema,
  templateTransacaoUpdateParamsSchema,
  templateTransacaoUpdateRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleTemplateTransacaoRepository, InMemoryTemplateTransacaoRepository } from './template-transacao.repository.js';
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

const defaultService = (): TemplateTransacaoService => {
  const repo =
    env.NODE_ENV === 'test'
      ? new InMemoryTemplateTransacaoRepository()
      : new DrizzleTemplateTransacaoRepository();

  // Placeholder creators — Task 8 will wire real implementations
  const transacaoCreator = { criar: async () => ({ id: '' }) };
  const cofrinhoService = { aportar: async () => ({ cofrinho: {}, movimentacao: {} }) };

  return new TemplateTransacaoService(repo, transacaoCreator as never, cofrinhoService as never);
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
          atualizadoEm: t.atualizadoEm instanceof Date ? t.atualizadoEm.toISOString() : t.atualizadoEm,
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
            criadoEm: template.criadoEm instanceof Date ? template.criadoEm.toISOString() : template.criadoEm,
            atualizadoEm: template.atualizadoEm instanceof Date ? template.atualizadoEm.toISOString() : template.atualizadoEm,
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
            criadoEm: template.criadoEm instanceof Date ? template.criadoEm.toISOString() : template.criadoEm,
            atualizadoEm: template.atualizadoEm instanceof Date ? template.atualizadoEm.toISOString() : template.atualizadoEm,
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
            criadoEm: template.criadoEm instanceof Date ? template.criadoEm.toISOString() : template.criadoEm,
            atualizadoEm: template.atualizadoEm instanceof Date ? template.atualizadoEm.toISOString() : template.atualizadoEm,
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
