import {
  familiaCreateInviteRequestSchema,
  familiaCreateRequestSchema,
  familiaJoinByInviteParamsSchema,
  familiaJoinByInviteRequestSchema,
  familiaRequestJoinRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleFamiliaRepository, InMemoryFamiliaRepository } from './familia.repository.js';
import {
  familiaCreateInviteSchema,
  familiaCreateSchema,
  familiaJoinByInviteSchema,
  familiaListJoinRequestsSchema,
  familiaRequestJoinSchema,
} from './familia.schema.js';
import {
  ForbiddenFamiliaJoinRequestListError,
  FamiliaService,
  ForbiddenFamiliaInviteError,
  InvalidFamiliaInviteCodeError,
} from './familia.service.js';

const defaultFamiliaService = (): FamiliaService => {
  if (env.NODE_ENV === 'test') {
    return new FamiliaService(new InMemoryFamiliaRepository());
  }

  return new FamiliaService(new DrizzleFamiliaRepository());
};

export const familiaRoutes: FastifyPluginAsync = async (fastify) => {
  const familiaService = defaultFamiliaService();

  fastify.post(
    '/familias',
    {
      preHandler: [fastify.authenticate],
      schema: familiaCreateSchema,
    },
    async (request, reply) => {
      const payload = familiaCreateRequestSchema.parse(request.body);
      const familia = await familiaService.create({
        nome: payload.nome,
        usuarioId: request.user.sub,
      });

      return reply.code(201).send({
        familia: {
          ...familia,
          dataCriacao: familia.dataCriacao.toISOString(),
        },
      });
    },
  );

  fastify.post(
    '/familias/convites',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: familiaCreateInviteSchema,
    },
    async (request, reply) => {
      try {
        familiaCreateInviteRequestSchema.parse(request.body);
        const convite = await familiaService.createInvite({
          familiaId: request.familiaIdAtiva as string,
          usuarioId: request.user.sub,
        });

        return reply.code(201).send({
          convite: {
            ...convite,
            expiraEm: convite.expiraEm.toISOString(),
            dataCriacao: convite.dataCriacao.toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof ForbiddenFamiliaInviteError) {
          return reply.code(403).send({ message: error.message });
        }

        throw error;
      }
    },
  );

  fastify.post(
    '/familias/entrar/:codigo',
    {
      preHandler: [fastify.authenticate],
      schema: familiaJoinByInviteSchema,
    },
    async (request, reply) => {
      try {
        const params = familiaJoinByInviteParamsSchema.parse(request.params);
        familiaJoinByInviteRequestSchema.parse(request.body);
        const familia = await familiaService.joinByInvite({
          codigo: params.codigo,
          usuarioId: request.user.sub,
        });

        return reply.code(200).send({
          familia: {
            ...familia,
            dataCriacao: familia.dataCriacao.toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof InvalidFamiliaInviteCodeError) {
          return reply.code(404).send({ message: error.message });
        }

        throw error;
      }
    },
  );

  fastify.post(
    '/familias/solicitar',
    {
      preHandler: [fastify.authenticate],
      schema: familiaRequestJoinSchema,
    },
    async (request, reply) => {
      const payload = familiaRequestJoinRequestSchema.parse(request.body);
      const solicitacao = await familiaService.requestJoin({
        familiaId: payload.familiaId,
        usuarioId: request.user.sub,
      });

      return reply.code(201).send({
        solicitacao: {
          ...solicitacao,
          solicitadoEm: solicitacao.solicitadoEm.toISOString(),
        },
      });
    },
  );

  fastify.get(
    '/familias/solicitacoes',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: familiaListJoinRequestsSchema,
    },
    async (request, reply) => {
      try {
        const solicitacoes = await familiaService.listPendingJoinRequests({
          familiaId: request.familiaIdAtiva as string,
          usuarioId: request.user.sub,
        });

        return reply.code(200).send({
          solicitacoes: solicitacoes.map((solicitacao) => ({
            ...solicitacao,
            solicitadoEm: solicitacao.solicitadoEm.toISOString(),
          })),
        });
      } catch (error) {
        if (error instanceof ForbiddenFamiliaJoinRequestListError) {
          return reply.code(403).send({ message: error.message });
        }

        throw error;
      }
    },
  );
};
