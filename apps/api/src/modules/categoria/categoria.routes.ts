import { categoriaCreateRequestSchema } from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleCategoriaRepository, InMemoryCategoriaRepository } from './categoria.repository.js';
import { categoriaCreateSchema, categoriaListSchema } from './categoria.schema.js';
import { CategoriaService } from './categoria.service.js';

const defaultCategoriaService = (): CategoriaService => {
  if (env.NODE_ENV === 'test') {
    return new CategoriaService(new InMemoryCategoriaRepository());
  }

  return new CategoriaService(new DrizzleCategoriaRepository());
};

export const categoriaRoutes: FastifyPluginAsync = async (fastify) => {
  const categoriaService = defaultCategoriaService();

  fastify.post(
    '/categorias',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: categoriaCreateSchema,
    },
    async (request, reply) => {
      const payload = categoriaCreateRequestSchema.parse(request.body);
      const categoria = await categoriaService.create({
        familiaId: request.familiaIdAtiva as string,
        nome: payload.nome,
        tipo: payload.tipo,
        criadoPor: request.user.sub,
      });

      return reply.code(201).send({
        categoria: {
          ...categoria,
          criadoEm: categoria.criadoEm.toISOString(),
        },
      });
    },
  );

  fastify.get(
    '/categorias',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: categoriaListSchema,
    },
    async (request, reply) => {
      const categorias = await categoriaService.listByFamiliaId({
        familiaId: request.familiaIdAtiva as string,
      });

      return reply.code(200).send({
        categorias: categorias.map((categoria) => ({
          ...categoria,
          criadoEm: categoria.criadoEm.toISOString(),
        })),
      });
    },
  );
};
