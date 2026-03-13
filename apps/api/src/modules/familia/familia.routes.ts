import { familiaCreateRequestSchema } from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleFamiliaRepository, InMemoryFamiliaRepository } from './familia.repository.js';
import { familiaCreateSchema } from './familia.schema.js';
import { FamiliaService } from './familia.service.js';

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
};
