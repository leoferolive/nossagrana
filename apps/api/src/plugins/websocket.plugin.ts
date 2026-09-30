import EventEmitter from 'node:events';

import fp from 'fastify-plugin';

import { WebSocketManager } from '../modules/ws/websocket-manager.js';
import { WS_CLOSE_FAMILIA_EXCLUIDA } from '../modules/ws/ws-close-codes.js';
import { registrarOuvintesDeSessaoEMembro } from '../modules/ws/ws-sessao-listeners.js';
import {
  ehFamiliaExcluidaEvento,
  FAMILIA_EXCLUIDA_EVENTO,
} from '../shared/familia-lifecycle/familia-lifecycle.events.js';

declare module 'fastify' {
  interface FastifyInstance {
    wsManager: WebSocketManager;
    eventBus?: EventEmitter;
  }
}

export const websocketPlugin = fp(async (fastify) => {
  await fastify.register(import('@fastify/websocket'));

  const wsManager = new WebSocketManager();
  const eventBus = new EventEmitter();

  fastify.decorate('wsManager', wsManager);
  fastify.decorate('eventBus', eventBus);

  // Ouve evento de negócio e faz broadcast para a família
  eventBus.on('transacao:alterada', ({ familiaId }: { familiaId: string }) => {
    wsManager.broadcast(familiaId, { tipo: 'transacao:alterada', familiaId });
  });

  // Publicado pelo service DEPOIS do commit da exclusão (#66): encerra os sockets da família.
  eventBus.on(FAMILIA_EXCLUIDA_EVENTO, (evento: unknown) => {
    if (!ehFamiliaExcluidaEvento(evento)) {
      fastify.log.warn(
        { evento },
        `Evento ${FAMILIA_EXCLUIDA_EVENTO} ignorado: recebido ${JSON.stringify(evento)}, esperado { familiaId: string }`,
      );
      return;
    }
    wsManager.closeFamily(evento.familiaId, WS_CLOSE_FAMILIA_EXCLUIDA, 'Familia excluida');
  });

  // Revogação de sessão e remoção de membro (#119): fecha só os sockets afetados.
  registrarOuvintesDeSessaoEMembro(eventBus, wsManager, fastify.log);

  // Heartbeat a cada 30s
  const HEARTBEAT_INTERVAL = 30_000;
  const PONG_TIMEOUT = 10_000;

  const heartbeatTimer = setInterval(() => {
    for (const [familiaId, room] of wsManager.entries()) {
      for (const ws of room) {
        if (ws.readyState !== 1) {
          wsManager.leave(familiaId, ws);
          continue;
        }
        let alive = false;
        ws.once('pong', () => {
          alive = true;
        });
        ws.ping();
        setTimeout(() => {
          if (!alive) {
            ws.terminate?.();
            wsManager.leave(familiaId, ws);
          }
        }, PONG_TIMEOUT);
      }
    }
  }, HEARTBEAT_INTERVAL);

  fastify.addHook('onClose', () => clearInterval(heartbeatTimer));
});
