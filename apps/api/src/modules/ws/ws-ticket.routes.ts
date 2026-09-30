import type { FastifyPluginAsync } from 'fastify';

import { WsTicketSessaoRevogadaError } from './ws-ticket.service.js';
import { wsTicketSchema } from './ws-ticket.schema.js';

/**
 * Emite o ticket efêmero do WebSocket (#118). Membership validada por `requireFamiliaScope`
 * (regra #2 de security.md) antes de emitir; sessão revogada (#119) não obtém ticket
 * (regra no `WsTicketService`).
 *
 * O rate limit roda em `preHandler` (depois de `authenticate`) para contar por usuário e não por IP:
 * várias pessoas atrás do mesmo NAT/CGNAT não disputam o mesmo orçamento.
 */
export const wsTicketRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/ws/ticket',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: wsTicketSchema,
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          hook: 'preHandler',
          keyGenerator: (request) => request.user?.sub ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      try {
        const { ticket, expiraEm } = await fastify.wsTickets.emitir({
          userId: request.user.sub,
          familiaId: request.familiaIdAtiva as string,
          emitidoEm: request.user.iat,
        });
        return { data: { ticket, expiraEm: expiraEm.toISOString() } };
      } catch (err) {
        if (!(err instanceof WsTicketSessaoRevogadaError)) throw err;
        return reply
          .code(401)
          .send({ error: { message: 'Sessao revogada', code: 'SESSION_REVOKED' } });
      }
    },
  );
};
