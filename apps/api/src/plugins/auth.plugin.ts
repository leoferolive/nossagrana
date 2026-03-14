import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../config/env.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      tokenType?: string;
    };
    user: {
      sub: string;
      email: string;
      tokenType?: string;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (fastify) => {
  await fastify.register(import('@fastify/jwt'), {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: 'Nao autenticado' });
    }
  });
});
