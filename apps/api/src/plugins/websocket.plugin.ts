import EventEmitter from 'node:events';

import fp from 'fastify-plugin';

import { WebSocketManager } from '../modules/ws/websocket-manager.js';

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
        ws.once('pong', () => { alive = true; });
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
