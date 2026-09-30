import type { WsTicketResponse } from '@nossagrana/types';

import type { ApiClient } from './api-client';
import { lazyApiClient } from './core-financeiro.service';

/**
 * Pede ao servidor o ticket efêmero (uso único, ~30 s) que autentica o handshake do WebSocket
 * sem colocar o JWT na URL (#118). Um ticket novo por (re)conexão: nunca reutilizar.
 */
export class WsTicketService {
  constructor(private readonly api: ApiClient) {}

  async emitir(familiaId: string): Promise<WsTicketResponse> {
    return this.api.request<WsTicketResponse>('/api/ws/ticket', {
      method: 'POST',
      headers: { 'X-Familia-Id': familiaId },
    });
  }
}

export const wsTicketService = new WsTicketService(lazyApiClient);
