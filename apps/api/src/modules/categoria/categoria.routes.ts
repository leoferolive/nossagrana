import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleCategoriaRepository, InMemoryCategoriaRepository } from './categoria.repository.js';
import { categoriaListSchema } from './categoria.schema.js';
import { CategoriaService } from './categoria.service.js';

const defaultCategoriaService = (): CategoriaService => {
  if (env.NODE_ENV === 'test') {
    return new CategoriaService(new InMemoryCategoriaRepository());
  }

  return new CategoriaService(new DrizzleCategoriaRepository());
};

export const categoriaRoutes: FastifyPluginAsync = async (fastify) => {
  const categoriaService = defaultCategoriaService();

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
