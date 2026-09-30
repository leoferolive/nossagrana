import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, type ApiClient } from './api-client';
import { WsTicketService } from './ws-ticket.service';

const buildApiClient = () => ({ request: vi.fn() }) as Pick<ApiClient, 'request'> as ApiClient;

describe('WsTicketService', () => {
  let apiClient: ApiClient;
  let service: WsTicketService;

  beforeEach(() => {
    apiClient = buildApiClient();
    service = new WsTicketService(apiClient);
  });

  it('emitir faz POST /api/ws/ticket com o header da família e devolve o ticket', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      ticket: 't'.repeat(43),
      expiraEm: '2026-09-30T12:00:30.000Z',
    });

    const resposta = await service.emitir('fam-1');

    expect(apiClient.request).toHaveBeenCalledWith('/api/ws/ticket', {
      method: 'POST',
      headers: { 'X-Familia-Id': 'fam-1' },
    });
    expect(resposta.ticket).toHaveLength(43);
  });

  it('propaga o erro da API (ex.: 403 sem acesso à família)', async () => {
    vi.mocked(apiClient.request).mockRejectedValueOnce(new ApiError(403, 'Erro'));

    await expect(service.emitir('fam-1')).rejects.toMatchObject({ status: 403 });
  });
});
