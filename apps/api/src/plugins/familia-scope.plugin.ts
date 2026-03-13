import { and, eq } from 'drizzle-orm';
import type { FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { usuarioFamilia } from '../db/schema.js';

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

      const [membership] = await db
        .select({ usuarioId: usuarioFamilia.usuarioId })
        .from(usuarioFamilia)
        .where(and(eq(usuarioFamilia.usuarioId, userId), eq(usuarioFamilia.familiaId, familiaId)))
        .limit(1);

      if (!membership) {
        reply.code(403).send({ message: 'Usuario sem acesso a familia informada' });
        return;
      }
    }

    request.familiaIdAtiva = familiaId;
  });
});
