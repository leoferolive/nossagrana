import { createHash } from 'node:crypto';

/** A quem o ticket pertence: usuário, família e a sessão (`iat` do access que o pediu, em segundos). */
export interface WsTicketDados {
  userId: string;
  familiaId: string;
  /** Claim `iat` do access usado na emissão; permite recusar o ticket se a sessão for revogada (#119). */
  emitidoEm: number | undefined;
}

/**
 * Armazenamento de tickets de WebSocket (#118). Só conhece o HASH do ticket: o valor bruto
 * existe apenas na resposta HTTP de emissão e na URL do handshake. O service é quem decide o
 * relógio; o store só compara instantes recebidos.
 */
export interface WsTicketStore {
  salvar(ticketHash: string, dados: WsTicketDados, expiraEm: Date): Promise<void>;
  /**
   * Consumo ATÔMICO e de uso único: devolve os dados e apaga o ticket na mesma operação, ou
   * `null` se o ticket não existe, já foi consumido ou expirou (`expiraEm <= agora`).
   * Duas chamadas simultâneas com o mesmo hash: só uma recebe os dados.
   */
  consumir(ticketHash: string, agora: Date): Promise<WsTicketDados | null>;
  /** Remove os tickets expirados que ninguém consumiu; devolve quantos saíram. */
  limparExpirados(agora: Date): Promise<number>;
}

/** SHA-256 em hex do ticket; é a única forma em que ele é persistido. */
export function hashWsTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}
