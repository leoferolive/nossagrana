import {
  categoriaCreateRequestSchema,
  categoriaDeleteParamsSchema,
  categoriaUpdateParamsSchema,
  categoriaUpdateRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import { DrizzleCategoriaRepository, InMemoryCategoriaRepository } from './categoria.repository.js';
import {
  categoriaCreateSchema,
  categoriaDeleteSchema,
  categoriaListSchema,
  categoriaUpdateSchema,
} from './categoria.schema.js';
import { CategoriaNotFoundError, CategoriaSistemaError, CategoriaService } from './categoria.service.js';

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

  fastify.patch(
    '/categorias/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: categoriaUpdateSchema,
    },
    async (request, reply) => {
      try {
        const params = categoriaUpdateParamsSchema.parse(request.params);
        const payload = categoriaUpdateRequestSchema.parse(request.body);
        const categoria = await categoriaService.update({
          id: params.id,
          familiaId: request.familiaIdAtiva as string,
          nome: payload.nome,
          tipo: payload.tipo,
        });

        return reply.code(200).send({
          categoria: {
            ...categoria,
            criadoEm: categoria.criadoEm.toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof CategoriaSistemaError) {
          return reply.code(403).send({ message: error.message });
        }

        if (error instanceof CategoriaNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }

        throw error;
      }
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

  fastify.delete(
    '/categorias/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: categoriaDeleteSchema,
    },
    async (request, reply) => {
      try {
        const params = categoriaDeleteParamsSchema.parse(request.params);
        const categoria = await categoriaService.deactivate({
          id: params.id,
          familiaId: request.familiaIdAtiva as string,
        });

        return reply.code(200).send({
          categoria: {
            ...categoria,
            criadoEm: categoria.criadoEm.toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof CategoriaSistemaError) {
          return reply.code(403).send({ message: error.message });
        }

        if (error instanceof CategoriaNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }

        throw error;
      }
    },
  );
};
