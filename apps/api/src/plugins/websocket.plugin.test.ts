import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WS_CLOSE_FAMILIA_EXCLUIDA,
  WS_CLOSE_MEMBRO_REMOVIDO,
  WS_CLOSE_SESSAO_REVOGADA,
} from '../modules/ws/ws-close-codes.js';
import { WebSocketFake } from '../modules/ws/tests/websocket-fake.js';
import {
  EventBusFamiliaLifecyclePublisher,
  type FamiliaLifecycleLogger,
} from '../shared/familia-lifecycle/familia-lifecycle.events.js';
import { EventBusSessaoLifecyclePublisher } from '../shared/sessao-lifecycle/sessao-lifecycle.events.js';
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
    for (const ws of daFamiliaA) app.wsManager.join('fA', ws.comoWebSocket(), 'u1');
    app.wsManager.join('fB', daFamiliaB.comoWebSocket(), 'u1');
    return { app, daFamiliaA, daFamiliaB };
  }

  it('fecha os sockets da família excluída com o código 4004 e preserva os de outra família', async () => {
    const { app, daFamiliaA, daFamiliaB } = await appComSockets();

    new EventBusFamiliaLifecyclePublisher(app.eventBus!, app.log).familiaExcluida('fA');

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

    new EventBusFamiliaLifecyclePublisher(app.eventBus!, app.log).familiaExcluida('fA');

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

  it('loga e engole a falha de um listener em vez de propagá-la a quem publica', async () => {
    const app = await criarApp();
    apps.push(app);
    const erros: Array<{ contexto: object; mensagem: string }> = [];
    const logFake: FamiliaLifecycleLogger = {
      error: (contexto, mensagem) => erros.push({ contexto, mensagem }),
    };
    app.eventBus!.on('familia:excluida', () => {
      throw new Error('listener quebrado');
    });

    expect(() =>
      new EventBusFamiliaLifecyclePublisher(app.eventBus!, logFake).familiaExcluida('fA'),
    ).not.toThrow();

    expect(erros).toHaveLength(1);
    expect(erros[0]!.contexto).toMatchObject({ familiaId: 'fA' });
    expect(erros[0]!.mensagem).toContain('fA');
  });
});

describe('websocketPlugin — sessão revogada e membro removido (#119)', () => {
  const apps: Array<Awaited<ReturnType<typeof criarApp>>> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  async function appComUsuarios() {
    const app = await criarApp();
    apps.push(app);
    const anaF1 = new WebSocketFake();
    const anaF2 = new WebSocketFake();
    const brunoF1 = new WebSocketFake();
    app.wsManager.join('fA', anaF1.comoWebSocket(), 'ana');
    app.wsManager.join('fB', anaF2.comoWebSocket(), 'ana');
    app.wsManager.join('fA', brunoF1.comoWebSocket(), 'bruno');
    return { app, anaF1, anaF2, brunoF1 };
  }

  it('sessões revogadas fecham todos os sockets do usuário (4005) e nenhum de outro', async () => {
    const { app, anaF1, anaF2, brunoF1 } = await appComUsuarios();

    new EventBusSessaoLifecyclePublisher(app.eventBus!, app.log).sessoesRevogadas('ana');

    const esperado = { codigo: WS_CLOSE_SESSAO_REVOGADA, motivo: 'Sessao revogada' };
    expect(anaF1.fechamento).toEqual(esperado);
    expect(anaF2.fechamento).toEqual(esperado);
    expect(brunoF1.fechamento).toBeNull();
  });

  it('membro removido fecha só os sockets dele naquela família (4006)', async () => {
    const { app, anaF1, anaF2, brunoF1 } = await appComUsuarios();

    new EventBusFamiliaLifecyclePublisher(app.eventBus!, app.log).membroRemovido('fA', 'ana');

    expect(anaF1.fechamento).toEqual({
      codigo: WS_CLOSE_MEMBRO_REMOVIDO,
      motivo: 'Membro removido',
    });
    expect(anaF2.fechamento).toBeNull();
    expect(brunoF1.fechamento).toBeNull();
  });

  it('não envia nenhum dado ao encerrar (só código e motivo genérico, sem ids)', async () => {
    const { app, anaF1 } = await appComUsuarios();

    new EventBusSessaoLifecyclePublisher(app.eventBus!, app.log).sessoesRevogadas('ana');

    expect(anaF1.enviadas).toEqual([]);
    expect(JSON.stringify(anaF1.fechamento)).not.toContain('ana');
  });

  it('ignora eventos malformados sem fechar sockets', async () => {
    const { app, anaF1, brunoF1 } = await appComUsuarios();

    expect(() => app.eventBus!.emit('sessao:revogadas', { userId: 1 })).not.toThrow();
    expect(() => app.eventBus!.emit('sessao:revogadas', undefined)).not.toThrow();
    expect(() => app.eventBus!.emit('familia:membro-removido', { familiaId: 'fA' })).not.toThrow();

    expect(anaF1.fechamento).toBeNull();
    expect(brunoF1.fechamento).toBeNull();
  });
});

describe('websocketPlugin — heartbeat e broadcast', () => {
  const HEARTBEAT_MS = 30_000;
  const PONG_TIMEOUT_MS = 10_000;

  const apps: Array<Awaited<ReturnType<typeof criarApp>>> = [];

  afterEach(async () => {
    // Fecha os apps mesmo se uma asserção falhar antes, para não vazar o setInterval do heartbeat.
    await Promise.all(apps.splice(0).map((app) => app.close()));
    vi.useRealTimers();
  });

  async function appRastreado() {
    const app = await criarApp();
    apps.push(app);
    return app;
  }

  async function appComTimersFalsos() {
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'clearInterval'] });
    return appRastreado();
  }

  it('repassa transacao:alterada apenas aos sockets da própria família', async () => {
    const app = await appRastreado();
    const daFamiliaA = new WebSocketFake();
    const daFamiliaB = new WebSocketFake();
    app.wsManager.join('fA', daFamiliaA.comoWebSocket(), 'u1');
    app.wsManager.join('fB', daFamiliaB.comoWebSocket(), 'u1');

    app.eventBus!.emit('transacao:alterada', { familiaId: 'fA' });

    expect(daFamiliaA.enviadas).toHaveLength(1);
    expect(JSON.parse(daFamiliaA.enviadas[0]!)).toEqual({
      tipo: 'transacao:alterada',
      familiaId: 'fA',
    });
    expect(daFamiliaB.enviadas).toEqual([]);
  });

  it('envia ping a cada 30s e mantém o socket que responde pong', async () => {
    const app = await appComTimersFalsos();
    const vivo = new WebSocketFake();
    app.wsManager.join('fA', vivo.comoWebSocket(), 'u1');

    vi.advanceTimersByTime(HEARTBEAT_MS);
    expect(vivo.pings).toBe(1);
    vivo.responderPong();
    vi.advanceTimersByTime(PONG_TIMEOUT_MS);

    expect(vivo.encerradoPorTerminate).toBe(false);
    expect(app.wsManager.roomSize('fA')).toBe(1);
  });

  it('termina e remove o socket que não responde pong dentro do timeout', async () => {
    const app = await appComTimersFalsos();
    const morto = new WebSocketFake();
    app.wsManager.join('fA', morto.comoWebSocket(), 'u1');

    vi.advanceTimersByTime(HEARTBEAT_MS + PONG_TIMEOUT_MS);

    expect(morto.encerradoPorTerminate).toBe(true);
    expect(app.wsManager.roomSize('fA')).toBe(0);
  });

  it('remove sem ping o socket que já não está aberto', async () => {
    const app = await appComTimersFalsos();
    const fechado = new WebSocketFake();
    fechado.readyState = 3;
    app.wsManager.join('fA', fechado.comoWebSocket(), 'u1');

    vi.advanceTimersByTime(HEARTBEAT_MS);

    expect(fechado.pings).toBe(0);
    expect(app.wsManager.roomSize('fA')).toBe(0);
  });

  it('para o heartbeat ao fechar o app', async () => {
    const app = await appComTimersFalsos();
    const ws = new WebSocketFake();
    app.wsManager.join('fA', ws.comoWebSocket(), 'u1');

    await app.close();
    vi.advanceTimersByTime(HEARTBEAT_MS * 2);

    expect(ws.pings).toBe(0);
  });
});
