import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RelogioFake } from '../modules/ws/tests/relogio-fake.js';
import { InMemoryWsTicketStore } from '../modules/ws/ws-ticket.store.js';
import { WS_TICKET_TTL_MS } from '../modules/ws/ws-ticket.service.js';
import type { WsTicketStore } from '../modules/ws/ws-ticket.types.js';

import { wsTicketPlugin } from './ws-ticket.plugin.js';

const FAMILIA = '11111111-1111-4111-8111-111111111111';
const INTERVALO_MS = 1000;

/** Fake nomeada de um store cuja limpeza falha, para provar que a varredura não derruba a app. */
class StoreComLimpezaQuebrada extends InMemoryWsTicketStore implements WsTicketStore {
  limpezas = 0;

  override async limparExpirados(): Promise<number> {
    this.limpezas += 1;
    throw new Error('armazenamento indisponível');
  }
}

describe('wsTicketPlugin', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('decora a instância com o serviço de tickets', async () => {
    const app = Fastify();
    await app.register(wsTicketPlugin);

    const { ticket } = await app.wsTickets.emitir({
      userId: 'u1',
      familiaId: FAMILIA,
      emitidoEm: 1,
    });

    expect(await app.wsTickets.consumir(ticket, FAMILIA)).toMatchObject({ userId: 'u1' });
    await app.close();
  });

  it('varre periodicamente os tickets expirados que ninguém consumiu', async () => {
    vi.useFakeTimers();
    const relogio = new RelogioFake();
    const store = new InMemoryWsTicketStore();
    const app = Fastify();
    await app.register(wsTicketPlugin, {
      store,
      agora: relogio.agora,
      intervaloLimpezaMs: INTERVALO_MS,
    });
    await app.wsTickets.emitir({ userId: 'u1', familiaId: FAMILIA, emitidoEm: 1 });
    relogio.avancar(WS_TICKET_TTL_MS);

    await vi.advanceTimersByTimeAsync(INTERVALO_MS);

    expect(store.chavesArmazenadas()).toHaveLength(0);
    await app.close();
  });

  it('falha na varredura é logada e não derruba a aplicação', async () => {
    vi.useFakeTimers();
    const store = new StoreComLimpezaQuebrada();
    const app = Fastify();
    await app.register(wsTicketPlugin, { store, intervaloLimpezaMs: INTERVALO_MS });

    await vi.advanceTimersByTimeAsync(INTERVALO_MS * 2);

    expect(store.limpezas).toBe(2);
    await app.close();
  });

  it('ao fechar a app a varredura para', async () => {
    vi.useFakeTimers();
    const store = new StoreComLimpezaQuebrada();
    const app = Fastify();
    await app.register(wsTicketPlugin, { store, intervaloLimpezaMs: INTERVALO_MS });
    await app.close();

    await vi.advanceTimersByTimeAsync(INTERVALO_MS * 3);

    expect(store.limpezas).toBe(0);
  });
});
