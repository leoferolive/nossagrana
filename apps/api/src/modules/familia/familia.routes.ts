import { familiaCreateInviteRequestSchema, familiaCreateRequestSchema } from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleFamiliaRepository, InMemoryFamiliaRepository } from './familia.repository.js';
import { familiaCreateInviteSchema, familiaCreateSchema } from './familia.schema.js';
import { FamiliaService, ForbiddenFamiliaInviteError } from './familia.service.js';

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
};
