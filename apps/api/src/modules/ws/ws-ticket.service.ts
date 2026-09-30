import { randomBytes } from 'node:crypto';

import { hashWsTicket, type WsTicketDados, type WsTicketStore } from './ws-ticket.types.js';

/** Vida do ticket: só precisa cobrir o intervalo entre o `POST` de emissão e o handshake. */
export const WS_TICKET_TTL_MS = 30_000;

const BYTES_DE_ENTROPIA = 32;

export interface WsTicketEmitido {
  /** Valor bruto: aparece só aqui e na URL do handshake; nunca é persistido nem logado. */
  ticket: string;
  expiraEm: Date;
}

/**
 * Emite e consome tickets efêmeros de WebSocket (#118): aleatórios (256 bits), de uso único,
 * vinculados a usuário + família + sessão. O JWT nunca entra no ticket nem na URL do WS.
 *
 * Ex.: `const { ticket } = await tickets.emitir({ userId, familiaId, emitidoEm: iat })`;
 * no handshake, `await tickets.consumir(ticket, familiaIdDaQuery)` (`null` = recusar).
 */
export class WsTicketService {
  constructor(
    private readonly store: WsTicketStore,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  async emitir(dados: WsTicketDados): Promise<WsTicketEmitido> {
    const ticket = randomBytes(BYTES_DE_ENTROPIA).toString('base64url');
    const expiraEm = new Date(this.agora().getTime() + WS_TICKET_TTL_MS);
    await this.store.salvar(hashWsTicket(ticket), dados, expiraEm);
    return { ticket, expiraEm };
  }

  /**
   * Consome o ticket (uma única vez) e confere a família pedida no handshake. Ticket de outra
   * família também é queimado: quem tenta reaproveitá-lo em outro room perde o ticket.
   * Não distingue inexistente, expirado, reutilizado ou de outra família (resposta única).
   */
  async consumir(ticket: string, familiaId: string): Promise<WsTicketDados | null> {
    const dados = await this.store.consumir(hashWsTicket(ticket), this.agora());
    if (!dados || dados.familiaId !== familiaId) return null;
    return dados;
  }

  limparExpirados(): Promise<number> {
    return this.store.limparExpirados(this.agora());
  }
}
