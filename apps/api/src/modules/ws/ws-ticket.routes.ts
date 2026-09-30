import type { FastifyPluginAsync } from 'fastify';

import { wsTicketSchema } from './ws-ticket.schema.js';

/** `iat` (segundos) do access que autenticou a requisição; o `user` tipado não o expõe. */
function emitidoEmDoAccess(user: object): number | undefined {
  const { iat } = user as { iat?: number };
  return iat;
}

/**
 * Emite o ticket efêmero do WebSocket (#118). Membership validada por `requireFamiliaScope`
 * (regra #2 de security.md) antes de emitir; sessão revogada (#119) não obtém ticket.
 */
export const wsTicketRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/ws/ticket',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: wsTicketSchema,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const userId = request.user.sub;
      const emitidoEm = emitidoEmDoAccess(request.user);
      if (await fastify.sessoes.estaRevogada(userId, emitidoEm)) {
        return reply.code(401).send({ message: 'Sessao revogada', code: 'SESSION_REVOKED' });
      }

      const familiaId = request.familiaIdAtiva as string;
      const { ticket, expiraEm } = await fastify.wsTickets.emitir({ userId, familiaId, emitidoEm });
      return { ticket, expiraEm: expiraEm.toISOString() };
    },
  );
};
