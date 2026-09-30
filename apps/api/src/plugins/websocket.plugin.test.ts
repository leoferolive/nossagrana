import Fastify from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { WS_CLOSE_FAMILIA_EXCLUIDA } from '../modules/ws/ws-close-codes.js';
import { WebSocketFake } from '../modules/ws/tests/websocket-fake.js';
import { EventBusFamiliaLifecyclePublisher } from '../shared/familia-lifecycle/familia-lifecycle.events.js';
import { websocketPlugin } from './websocket.plugin.js';

async function criarApp() {
  const app = Fastify();
  await app.register(websocketPlugin);
  await app.ready();
  return app;
}

describe('websocketPlugin — ciclo de vida da família', () => {
  const apps: Array<Awaited<ReturnType<typeof criarApp>>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function appComSockets() {
    const app = await criarApp();
    apps.push(app);
    const daFamiliaA = [new WebSocketFake(), new WebSocketFake()];
    const daFamiliaB = new WebSocketFake();
    for (const ws of daFamiliaA) app.wsManager.join('fA', ws.comoWebSocket());
    app.wsManager.join('fB', daFamiliaB.comoWebSocket());
    return { app, daFamiliaA, daFamiliaB };
  }

  it('fecha os sockets da família excluída com o código 4004 e preserva os de outra família', async () => {
    const { app, daFamiliaA, daFamiliaB } = await appComSockets();

    new EventBusFamiliaLifecyclePublisher(app.eventBus!).familiaExcluida('fA');

    for (const ws of daFamiliaA) {
      expect(ws.fechamento).toEqual({
        codigo: WS_CLOSE_FAMILIA_EXCLUIDA,
        motivo: 'Familia excluida',
      });
    }
    expect(daFamiliaB.fechamento).toBeNull();
    expect(app.wsManager.roomSize('fA')).toBe(0);
    expect(app.wsManager.roomSize('fB')).toBe(1);
  });

  it('não envia nenhum dado da família aos sockets ao encerrar (só código e motivo genérico)', async () => {
    const { app, daFamiliaA } = await appComSockets();

    new EventBusFamiliaLifecyclePublisher(app.eventBus!).familiaExcluida('fA');

    for (const ws of daFamiliaA) {
      expect(ws.enviadas).toEqual([]);
      expect(JSON.stringify(ws.fechamento)).not.toContain('fA');
    }
  });

  it('ignora evento com payload malformado sem derrubar o processo nem fechar sockets', async () => {
    const { app, daFamiliaA } = await appComSockets();

    expect(() => app.eventBus!.emit('familia:excluida', { familiaId: 123 })).not.toThrow();
    expect(() => app.eventBus!.emit('familia:excluida', undefined)).not.toThrow();

    for (const ws of daFamiliaA) expect(ws.fechamento).toBeNull();
  });
});
