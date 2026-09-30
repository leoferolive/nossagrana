import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock global WebSocket
const mockWs = {
  close: vi.fn(),
  onopen: null as ((event: Event) => void) | null,
  onclose: null as ((event: CloseEvent) => void) | null,
  onmessage: null as ((event: MessageEvent) => void) | null,
  readyState: 1,
};
vi.stubGlobal(
  'WebSocket',
  vi.fn(() => mockWs),
);

const mockFetchAll = vi.fn();
vi.mock('./dashboard.store', () => ({
  useDashboardStore: { getState: () => ({ fetchAll: mockFetchAll }) },
}));

const mockEmitirTicket = vi.hoisted(() => vi.fn());
vi.mock('../services/ws-ticket.service', () => ({
  wsTicketService: { emitir: mockEmitirTicket },
}));

import { act, renderHook } from '@testing-library/react';
import { ApiError } from '../services/api-client';
import { useWebSocketStore } from './websocket.store';

let contadorDeTickets = 0;
const proximoTicket = () => ({
  ticket: `ticket-${(contadorDeTickets += 1)}`,
  expiraEm: '2026-09-30T12:00:30.000Z',
});

/** Deixa as promises pendentes (emissão do ticket) resolverem antes do próximo passo. */
const conectar = async (
  result: { current: ReturnType<typeof useWebSocketStore.getState> },
  clearSession = vi.fn(),
  familiaId = 'f1',
) => {
  await act(async () => {
    result.current.connect({ familiaId, clearSession });
  });
  return clearSession;
};

const fecharComCodigo = async (code: number) => {
  await act(async () => {
    mockWs.onclose?.({ code } as CloseEvent);
    await vi.runAllTimersAsync();
  });
};

describe('useWebSocketStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    contadorDeTickets = 0;
    mockEmitirTicket.mockImplementation(async () => proximoTicket());
    useWebSocketStore.setState({ socket: null, status: 'disconnected' });
  });

  afterEach(() => {
    // Limpar store e timers pendentes antes de voltar a real timers
    const { disconnect } = useWebSocketStore.getState();
    disconnect();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('estado inicial é disconnected', () => {
    const { result } = renderHook(() => useWebSocketStore());
    expect(result.current.status).toBe('disconnected');
    expect(result.current.socket).toBeNull();
  });

  it('connect fica em connecting enquanto o ticket é emitido', () => {
    mockEmitirTicket.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useWebSocketStore());

    act(() => {
      result.current.connect({ familiaId: 'f1', clearSession: vi.fn() });
    });

    expect(result.current.status).toBe('connecting');
    expect(WebSocket).not.toHaveBeenCalled();
  });

  it('abre o WebSocket com o ticket e a família, sem nenhum token na URL', async () => {
    const { result } = renderHook(() => useWebSocketStore());

    await conectar(result);

    expect(mockEmitirTicket).toHaveBeenCalledWith('f1');
    const url = vi.mocked(WebSocket).mock.calls[0]![0] as string;
    expect(url).toContain('ticket=ticket-1');
    expect(url).toContain('familiaId=f1');
    expect(url).not.toMatch(/[?&]token=/);
    expect(result.current.status).toBe('connecting');
  });

  it('mensagem transacao:alterada chama fetchAll', async () => {
    const { result } = renderHook(() => useWebSocketStore());
    await conectar(result);

    act(() => {
      mockWs.onopen?.(new Event('open'));
      mockWs.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ tipo: 'transacao:alterada', familiaId: 'f1' }),
        }),
      );
    });

    expect(result.current.status).toBe('connected');
    expect(mockFetchAll).toHaveBeenCalledWith('f1');
  });

  it('disconnect fecha socket e limpa estado', async () => {
    const { result } = renderHook(() => useWebSocketStore());
    await conectar(result);

    act(() => {
      result.current.disconnect();
    });

    expect(mockWs.close).toHaveBeenCalled();
    expect(result.current.status).toBe('disconnected');
  });

  it('cada reconexão pede um ticket novo e nunca reutiliza o anterior', async () => {
    const { result } = renderHook(() => useWebSocketStore());
    await conectar(result);

    await fecharComCodigo(1006);

    expect(mockEmitirTicket).toHaveBeenCalledTimes(2);
    const urls = vi.mocked(WebSocket).mock.calls.map(([url]) => url as string);
    expect(urls[0]).toContain('ticket=ticket-1');
    expect(urls[1]).toContain('ticket=ticket-2');
  });

  it('ticket recusado no handshake (4001): reconecta com ticket novo', async () => {
    const { result } = renderHook(() => useWebSocketStore());
    await conectar(result);

    await fecharComCodigo(4001);

    expect(mockEmitirTicket).toHaveBeenCalledTimes(2);
    expect(WebSocket).toHaveBeenCalledTimes(2);
  });

  it('desconectar enquanto o ticket é emitido não abre socket', async () => {
    let liberar!: (valor: ReturnType<typeof proximoTicket>) => void;
    mockEmitirTicket.mockReturnValue(new Promise((resolve) => (liberar = resolve)));
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({ familiaId: 'f1', clearSession: vi.fn() });
    });

    await act(async () => {
      result.current.disconnect();
      liberar(proximoTicket());
    });

    expect(WebSocket).not.toHaveBeenCalled();
    expect(result.current.status).toBe('disconnected');
  });

  it('fechamento de um socket já substituído por connect/disconnect não reconecta', async () => {
    const { result } = renderHook(() => useWebSocketStore());
    const clearSession = await conectar(result);

    act(() => {
      result.current.disconnect();
    });
    await fecharComCodigo(1006);

    expect(mockEmitirTicket).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('falha transitória ao emitir o ticket: tenta de novo com backoff', async () => {
    mockEmitirTicket
      .mockRejectedValueOnce(new ApiError(500, 'Erro'))
      .mockImplementation(async () => proximoTicket());
    const { result } = renderHook(() => useWebSocketStore());

    await act(async () => {
      result.current.connect({ familiaId: 'f1', clearSession: vi.fn() });
      await vi.runAllTimersAsync();
    });

    expect(mockEmitirTicket).toHaveBeenCalledTimes(2);
    expect(WebSocket).toHaveBeenCalledTimes(1);
  });

  it('falhas repetidas ao emitir o ticket esgotam as tentativas sem derrubar a sessão', async () => {
    mockEmitirTicket.mockRejectedValue(new ApiError(500, 'Erro'));
    const clearSession = vi.fn();
    const { result } = renderHook(() => useWebSocketStore());

    await act(async () => {
      result.current.connect({ familiaId: 'f1', clearSession });
      await vi.runAllTimersAsync();
    });

    expect(WebSocket).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
    expect(result.current.status).toBe('error');
  });

  it('429 ao emitir o ticket: espera o Retry-After, tenta de novo e nunca encerra a sessão', async () => {
    mockEmitirTicket
      .mockRejectedValueOnce(new ApiError(429, 'Erro', 30_000))
      .mockImplementation(async () => proximoTicket());
    const clearSession = vi.fn();
    const { result } = renderHook(() => useWebSocketStore());

    await act(async () => {
      result.current.connect({ familiaId: 'f1', clearSession });
      await vi.advanceTimersByTimeAsync(29_999);
    });
    expect(mockEmitirTicket).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(mockEmitirTicket).toHaveBeenCalledTimes(2);
    expect(WebSocket).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('429 repetido (mais vezes que o limite de tentativas): segue esperando, sem logout', async () => {
    mockEmitirTicket.mockRejectedValue(new ApiError(429, 'Erro', 1_000));
    const clearSession = vi.fn();
    const { result } = renderHook(() => useWebSocketStore());

    await act(async () => {
      result.current.connect({ familiaId: 'f1', clearSession });
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(mockEmitirTicket.mock.calls.length).toBeGreaterThan(6);
    expect(clearSession).not.toHaveBeenCalled();
    expect(result.current.status).toBe('connecting');
  });

  it('429 sem Retry-After usa uma espera padrão longa (não o backoff curto)', async () => {
    mockEmitirTicket.mockRejectedValue(new ApiError(429, 'Erro'));
    const { result } = renderHook(() => useWebSocketStore());

    await act(async () => {
      result.current.connect({ familiaId: 'f1', clearSession: vi.fn() });
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(mockEmitirTicket).toHaveBeenCalledTimes(1);
  });

  it('401 ao emitir o ticket (sessão inválida): encerra a sessão local e não reconecta', async () => {
    mockEmitirTicket.mockRejectedValue(new ApiError(401, 'Não autorizado'));
    const clearSession = vi.fn();
    const { result } = renderHook(() => useWebSocketStore());

    await act(async () => {
      result.current.connect({ familiaId: 'f1', clearSession });
      await vi.runAllTimersAsync();
    });

    expect(mockEmitirTicket).toHaveBeenCalledTimes(1);
    expect(WebSocket).not.toHaveBeenCalled();
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('403 ao emitir o ticket (sem acesso à família): não reconecta e mantém a sessão', async () => {
    mockEmitirTicket.mockRejectedValue(new ApiError(403, 'Erro'));
    const clearSession = vi.fn();
    const { result } = renderHook(() => useWebSocketStore());

    await act(async () => {
      result.current.connect({ familiaId: 'f1', clearSession });
      await vi.runAllTimersAsync();
    });

    expect(mockEmitirTicket).toHaveBeenCalledTimes(1);
    expect(WebSocket).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
    expect(result.current.status).toBe('disconnected');
  });

  it('não tenta reconectar quando a família foi excluída (4004)', async () => {
    const { result } = renderHook(() => useWebSocketStore());
    const clearSession = await conectar(result);

    await fecharComCodigo(4004);

    expect(WebSocket).toHaveBeenCalledTimes(1);
    expect(mockEmitirTicket).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('sessão revogada (4005): encerra a sessão local e não reconecta', async () => {
    const { result } = renderHook(() => useWebSocketStore());
    const clearSession = await conectar(result);

    await fecharComCodigo(4005);

    expect(WebSocket).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('membro removido da família (4006): não reconecta e mantém a sessão', async () => {
    const { result } = renderHook(() => useWebSocketStore());
    const clearSession = await conectar(result);

    await fecharComCodigo(4006);

    expect(WebSocket).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });
});
