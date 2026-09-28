import type { FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { verificarAcessoFamilia } from '../shared/familia-access/familia-access.repository.js';

declare module 'fastify' {
  interface FastifyInstance {
    requireFamiliaScope: (
      request: import('fastify').FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }

  interface FastifyRequest {
    familiaIdAtiva?: string;
  }
}

const familiaHeaderSchema = z.string().uuid();

export const familiaScopePlugin = fp(async (fastify) => {
  fastify.decorate('requireFamiliaScope', async (request, reply) => {
    const headerValue = request.headers['x-familia-id'];
    const familiaIdHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    const parsedHeader = familiaHeaderSchema.safeParse(familiaIdHeader);
    if (!parsedHeader.success) {
      reply.code(400).send({ message: 'familia_id invalido ou ausente' });
      return;
    }

    const familiaId = parsedHeader.data;

    if (env.NODE_ENV !== 'test') {
      const userId = request.user?.sub;
      if (!userId) {
        reply.code(401).send({ message: 'Nao autenticado' });
        return;
      }

      const acesso = await verificarAcessoFamilia(db, userId, familiaId);

      if (acesso === 'sem_acesso') {
        reply.code(403).send({ message: 'Usuario sem acesso a familia informada' });
        return;
      }

      if (acesso === 'excluida') {
        reply.code(403).send({
          error: { message: 'Familia excluida', code: 'FAMILIA_EXCLUIDA' },
        });
        return;
      }
    }

    request.familiaIdAtiva = familiaId;
  });
});
