import { timingSafeEqual } from 'node:crypto';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { DrizzleAdminRepository, InMemoryAdminRepository } from './admin.repository.js';
import { AdminService, FamiliaNotFoundOrActiveError, UserNotFoundError } from './admin.service.js';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const repo =
    env.NODE_ENV === 'test' ? new InMemoryAdminRepository() : new DrizzleAdminRepository();
  const adminService = new AdminService(repo);

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
    const secret = request.headers['x-admin-secret'];
    if (!secret || typeof secret !== 'string') {
      return reply.code(403).send({ message: 'Acesso negado' });
    }

    const secretBuffer = Buffer.from(secret);
    const expectedBuffer = Buffer.from(env.ADMIN_SECRET);

    if (
      secretBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(secretBuffer, expectedBuffer)
    ) {
      return reply.code(403).send({ message: 'Acesso negado' });
    }
  };

  fastify.patch(
    '/admin/familias/:familiaId/recuperar',
    {
      preHandler: [requireAdmin],
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ familiaId: z.string().uuid() }),
        response: {
          200: z.object({ id: z.string(), nome: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { familiaId } = request.params as { familiaId: string };
      try {
        const familia = await adminService.recuperarFamilia(familiaId);
        return reply.code(200).send(familia);
      } catch (error) {
        if (error instanceof FamiliaNotFoundOrActiveError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  fastify.post(
    '/admin/usuarios/:userId/impersonar',
    {
      preHandler: [requireAdmin],
      config: { rateLimit: { max: 3, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ userId: z.string().uuid() }),
        response: {
          200: z.object({ accessToken: z.string() }),
          403: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      try {
        const { userId: id, email } = await adminService.impersonarUsuario(userId);
        const accessToken = fastify.jwt.sign({ sub: id, email, impersonated: true });
        return reply.code(200).send({ accessToken });
      } catch (error) {
        if (error instanceof UserNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );
};
