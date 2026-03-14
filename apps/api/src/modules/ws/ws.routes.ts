import { and, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { usuarioFamilia } from '../../db/schema.js';

export const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (socket: WebSocket, request) => {
    const query = request.query as Record<string, string>;
    const token = query.token;
    const familiaId = query.familiaId;

    // Valida UUID básico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!token || !familiaId || !uuidRegex.test(familiaId)) {
      socket.close(4001, 'Parametros invalidos');
      return;
    }

    // Valida JWT
    let userId: string;
    try {
      const payload = fastify.jwt.verify<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      socket.close(4001, 'Token invalido ou expirado');
      return;
    }

    // Verifica membership (bypass em test)
    if (env.NODE_ENV !== 'test') {
      const [membership] = await db
        .select({ usuarioId: usuarioFamilia.usuarioId })
        .from(usuarioFamilia)
        .where(and(eq(usuarioFamilia.usuarioId, userId), eq(usuarioFamilia.familiaId, familiaId)))
        .limit(1);

      if (!membership) {
        socket.close(4003, 'Usuario sem acesso a familia');
        return;
      }
    }

    fastify.wsManager.join(familiaId, socket);

    socket.on('close', () => {
      fastify.wsManager.leave(familiaId, socket);
    });
  });
};
