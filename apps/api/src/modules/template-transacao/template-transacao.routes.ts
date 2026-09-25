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
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import {
  pedidoIdempotenteDaRequisicao,
  responderIdempotente,
} from '../../shared/idempotencia/idempotencia.http.js';
import type { RespostaGravada } from '../../shared/idempotencia/idempotencia.types.js';
import { ConflitoDeConcorrenciaError } from '../../shared/unit-of-work/conflito-concorrencia.js';
import { responderConflitoDeConcorrencia } from '../../shared/unit-of-work/conflito-concorrencia.http.js';
import { criarBuscaCategoriaCofrinho } from '../cofrinho/cofrinho.categoria.js';
import { CofrinhoEncerradoError, CofrinhoNotFoundError } from '../cofrinho/cofrinho.errors.js';
import {
  criarUnitOfWorkCofrinhoDrizzle,
  criarUnitOfWorkCofrinhoInMemory,
} from '../cofrinho/cofrinho.unit-of-work.js';
import { DrizzleReferenciaOwnershipRepository } from '../../shared/referencia-ownership/referencia-ownership.repository.js';
import {
  repositoriosInMemoryDe,
  validadorReferenciasInMemory,
} from '../../shared/repositorios-in-memory.js';
import { ReferenciaOwnershipValidator } from '../../shared/referencia-ownership/referencia-ownership.validator.js';
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
  TemplateSemCategoriaError,
  TemplateNotFoundError,
  TemplateTransacaoDuplicateError,
  TemplateTransacaoService,
} from './template-transacao.service.js';

/** Resposta do aplicar, gravada para replay da `Idempotency-Key` (#90). */
const respostaDoAplicar = (resultado: object): RespostaGravada => ({
  statusCode: 200,
  corpo: resultado,
});

const testGetCategoriaCofrinho = async () => ({ id: randomUUID() });

/**
 * `aplicar` grava lançamentos e aportes numa única Unit of Work (#89), com os
 * mesmos repositórios do cofrinho (test: InMemory compartilhado da app).
 */
const defaultService = (fastify: FastifyInstance): TemplateTransacaoService => {
  if (env.NODE_ENV === 'test') {
    const repositorios = repositoriosInMemoryDe(fastify);
    const uow = criarUnitOfWorkCofrinhoInMemory({
      cofrinhos: repositorios.cofrinhos,
      movimentacoes: repositorios.movimentacoesCofrinho,
      transacoes: repositorios.transacoes,
      idempotencia: repositorios.idempotencia,
    });
    return new TemplateTransacaoService(
      new InMemoryTemplateTransacaoRepository(),
      uow,
      testGetCategoriaCofrinho,
      validadorReferenciasInMemory(repositorios),
    );
  }

  /* v8 ignore next 6 -- production wiring */
  return new TemplateTransacaoService(
    new DrizzleTemplateTransacaoRepository(),
    criarUnitOfWorkCofrinhoDrizzle(db),
    criarBuscaCategoriaCofrinho(db),
    new ReferenciaOwnershipValidator(new DrizzleReferenciaOwnershipRepository()),
  );
};

export const templateTransacaoRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService(fastify);

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
        if (error instanceof TemplateTransacaoDuplicateError) {
          return reply.code(409).send({ message: error.message });
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
        const pedido = pedidoIdempotenteDaRequisicao(request);
        const payload = templateTransacaoAplicarRequestSchema.parse(request.body);
        const resultado = await service.aplicarIdempotente(
          {
            familiaId: request.familiaIdAtiva as string,
            usuarioId: request.user.sub,
            mesReferencia: payload.mesReferencia,
            itens: payload.itens,
          },
          pedido && { pedido, responder: respostaDoAplicar },
        );

        return responderIdempotente(reply, resultado, respostaDoAplicar);
      } catch (error) {
        if (error instanceof TemplateNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        if (error instanceof TemplateSemCategoriaError || error instanceof CofrinhoEncerradoError) {
          // Encerrado aqui = corrida: validado ativo, encerrado antes do aporte (nada gravado).
          return reply.code(400).send({ message: error.message });
        }
        if (error instanceof CofrinhoNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        if (error instanceof ConflitoDeConcorrenciaError) {
          return responderConflitoDeConcorrencia(error, request, reply);
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
