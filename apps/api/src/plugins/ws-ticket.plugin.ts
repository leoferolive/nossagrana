import fp from 'fastify-plugin';

import { InMemoryWsTicketStore } from '../modules/ws/ws-ticket.store.js';
import { WsTicketService } from '../modules/ws/ws-ticket.service.js';
import type { WsTicketStore } from '../modules/ws/ws-ticket.types.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Emissão/consumo de tickets efêmeros de WebSocket (#118), únicos desta instância. */
    wsTickets: WsTicketService;
  }
}

export interface WsTicketPluginOptions {
  /** Injeção para testes; por padrão, store em memória (réplica única, ver DECISIONS.md). */
  store?: WsTicketStore;
  /** Relógio injetável (testes de TTL). */
  agora?: () => Date;
  /** Intervalo da varredura de tickets expirados não consumidos. */
  intervaloLimpezaMs?: number;
}

const INTERVALO_LIMPEZA_PADRAO_MS = 60_000;

/**
 * Tickets que ninguém consumiu (cliente caiu entre o POST e o handshake) já não valem depois do
 * TTL; a varredura só devolve a memória. `unref` para não segurar o processo aberto.
 */
export const wsTicketPlugin = fp<WsTicketPluginOptions>(async (fastify, opts) => {
  const service = new WsTicketService(opts.store ?? new InMemoryWsTicketStore(), opts.agora);
  fastify.decorate('wsTickets', service);

  const limpeza = setInterval(() => {
    service.limparExpirados().catch((err: unknown) => {
      fastify.log.error({ err }, 'Falha ao limpar tickets de WebSocket expirados');
    });
  }, opts.intervaloLimpezaMs ?? INTERVALO_LIMPEZA_PADRAO_MS);
  limpeza.unref();

  fastify.addHook('onClose', () => clearInterval(limpeza));
});
