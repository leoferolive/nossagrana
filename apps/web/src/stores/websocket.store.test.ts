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

import { act, renderHook } from '@testing-library/react';
import { useWebSocketStore } from './websocket.store';

describe('useWebSocketStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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

  it('connect muda status para connecting e cria WebSocket', () => {
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({
        getAccessToken: () => 'token123',
        familiaId: 'f1',
        clearSession: vi.fn(),
      });
    });
    expect(result.current.status).toBe('connecting');
    expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('token=token123'));
    expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('familiaId=f1'));
  });

  it('mensagem transacao:alterada chama fetchAll', () => {
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({
        getAccessToken: () => 'tok',
        familiaId: 'f1',
        clearSession: vi.fn(),
      });
      // Simula onopen
      mockWs.onopen?.(new Event('open'));
      // Simula mensagem
      mockWs.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ tipo: 'transacao:alterada', familiaId: 'f1' }),
        }),
      );
    });
    expect(mockFetchAll).toHaveBeenCalledWith('f1');
  });

  it('disconnect fecha socket e limpa estado', () => {
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({
        getAccessToken: () => 'tok',
        familiaId: 'f1',
        clearSession: vi.fn(),
      });
      result.current.disconnect();
    });
    expect(mockWs.close).toHaveBeenCalled();
    expect(result.current.status).toBe('disconnected');
  });

  it('não tenta reconectar quando a família foi excluída (4004)', () => {
    const clearSession = vi.fn();
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({ getAccessToken: () => 'tok', familiaId: 'f1', clearSession });
      mockWs.onclose?.({ code: 4004 } as CloseEvent);
      vi.runAllTimers();
    });

    expect(WebSocket).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('sessão revogada (4005): encerra a sessão local e não reconecta', () => {
    const clearSession = vi.fn();
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({ getAccessToken: () => 'tok', familiaId: 'f1', clearSession });
      mockWs.onclose?.({ code: 4005 } as CloseEvent);
      vi.runAllTimers();
    });

    expect(WebSocket).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('membro removido da família (4006): não reconecta e mantém a sessão', () => {
    const clearSession = vi.fn();
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({ getAccessToken: () => 'tok', familiaId: 'f1', clearSession });
      mockWs.onclose?.({ code: 4006 } as CloseEvent);
      vi.runAllTimers();
    });

    expect(WebSocket).toHaveBeenCalledTimes(1);
    expect(clearSession).not.toHaveBeenCalled();
  });
});
