import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('websocketPlugin — heartbeat e broadcast', () => {
  const HEARTBEAT_MS = 30_000;
  const PONG_TIMEOUT_MS = 10_000;

  afterEach(() => {
    vi.useRealTimers();
  });

  async function appComTimersFalsos() {
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'clearInterval'] });
    return criarApp();
  }

  it('repassa transacao:alterada apenas aos sockets da própria família', async () => {
    const app = await criarApp();
    const daFamiliaA = new WebSocketFake();
    const daFamiliaB = new WebSocketFake();
    app.wsManager.join('fA', daFamiliaA.comoWebSocket());
    app.wsManager.join('fB', daFamiliaB.comoWebSocket());

    app.eventBus!.emit('transacao:alterada', { familiaId: 'fA' });

    expect(daFamiliaA.enviadas).toHaveLength(1);
    expect(JSON.parse(daFamiliaA.enviadas[0]!)).toEqual({
      tipo: 'transacao:alterada',
      familiaId: 'fA',
    });
    expect(daFamiliaB.enviadas).toEqual([]);
    await app.close();
  });

  it('envia ping a cada 30s e mantém o socket que responde pong', async () => {
    const app = await appComTimersFalsos();
    const vivo = new WebSocketFake();
    app.wsManager.join('fA', vivo.comoWebSocket());

    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(vivo.pings).toBe(1);
    vivo.responderPong();
    vi.advanceTimersByTime(PONG_TIMEOUT_MS);

    expect(vivo.encerradoPorTerminate).toBe(false);
    expect(app.wsManager.roomSize('fA')).toBe(1);
    await app.close();
  });

  it('termina e remove o socket que não responde pong dentro do timeout', async () => {
    const app = await appComTimersFalsos();
    const morto = new WebSocketFake();
    app.wsManager.join('fA', morto.comoWebSocket());

    vi.advanceTimersByTime(HEARTBEAT_MS + PONG_TIMEOUT_MS);

    expect(morto.encerradoPorTerminate).toBe(true);
    expect(app.wsManager.roomSize('fA')).toBe(0);
    await app.close();
  });

  it('remove sem ping o socket que já não está aberto', async () => {
    const app = await appComTimersFalsos();
    const fechado = new WebSocketFake();
    fechado.readyState = 3;
    app.wsManager.join('fA', fechado.comoWebSocket());

    vi.advanceTimersByTime(HEARTBEAT_MS);

    expect(fechado.pings).toBe(0);
    expect(app.wsManager.roomSize('fA')).toBe(0);
    await app.close();
  });

  it('para o heartbeat ao fechar o app', async () => {
    const app = await appComTimersFalsos();
    const ws = new WebSocketFake();
    app.wsManager.join('fA', ws.comoWebSocket());

    await app.close();
    vi.advanceTimersByTime(HEARTBEAT_MS * 2);

    expect(ws.pings).toBe(0);
  });
});
