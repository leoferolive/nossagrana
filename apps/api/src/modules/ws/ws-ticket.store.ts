import type { WsTicketDados, WsTicketStore } from './ws-ticket.types.js';

interface EntradaDeTicket {
  dados: WsTicketDados;
  expiraEm: Date;
}

/**
 * Store em memória (Map + TTL). Serve produção: a API roda em réplica única e o `WebSocketManager`
 * e o `eventBus` já são em processo (docs/DECISIONS.md, "Ticket efêmero de WebSocket (#118)").
 * O consumo é atômico porque `consumir` não tem nenhum `await` entre ler e apagar: o event loop
 * do Node não intercala outra chamada no meio.
 */
export class InMemoryWsTicketStore implements WsTicketStore {
  private readonly tickets = new Map<string, EntradaDeTicket>();

  async salvar(ticketHash: string, dados: WsTicketDados, expiraEm: Date): Promise<void> {
    this.tickets.set(ticketHash, { dados, expiraEm });
  }

  async consumir(ticketHash: string, agora: Date): Promise<WsTicketDados | null> {
    const entrada = this.tickets.get(ticketHash);
    if (!entrada) return null;
    this.tickets.delete(ticketHash);
    return entrada.expiraEm > agora ? entrada.dados : null;
  }

  async limparExpirados(agora: Date): Promise<number> {
    let removidos = 0;
    for (const [hash, { expiraEm }] of this.tickets) {
      if (expiraEm > agora) continue;
      this.tickets.delete(hash);
      removidos += 1;
    }
    return removidos;
  }

  /** Só para testes: prova que nada além do hash é guardado. */
  chavesArmazenadas(): string[] {
    return [...this.tickets.keys()];
  }
}
