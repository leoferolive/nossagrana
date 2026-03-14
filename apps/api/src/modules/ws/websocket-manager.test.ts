import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketManager } from './websocket-manager.js';

const mockSocket = (readyState = 1 /* OPEN */) => ({
  readyState,
  send: vi.fn(),
  close: vi.fn(),
  ping: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
});

describe('WebSocketManager', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('join adiciona socket ao room', () => {
    const ws = mockSocket() as unknown as import('ws').WebSocket;
    manager.join('f1', ws);
    expect(manager.roomSize('f1')).toBe(1);
  });

  it('leave remove socket do room', () => {
    const ws = mockSocket() as unknown as import('ws').WebSocket;
    manager.join('f1', ws);
    manager.leave('f1', ws);
    expect(manager.roomSize('f1')).toBe(0);
  });

  it('broadcast envia mensagem a todos sockets OPEN do room', () => {
    const ws1 = mockSocket() as unknown as import('ws').WebSocket;
    const ws2 = mockSocket() as unknown as import('ws').WebSocket;
    manager.join('f1', ws1);
    manager.join('f1', ws2);
    manager.broadcast('f1', { tipo: 'transacao:alterada' });
    expect(ws1.send).toHaveBeenCalledWith(JSON.stringify({ tipo: 'transacao:alterada' }));
    expect(ws2.send).toHaveBeenCalledWith(JSON.stringify({ tipo: 'transacao:alterada' }));
  });

  it('broadcast ignora sockets não-OPEN (readyState !== 1)', () => {
    const wsOpen = mockSocket(1) as unknown as import('ws').WebSocket;
    const wsClosing = mockSocket(2) as unknown as import('ws').WebSocket;
    manager.join('f1', wsOpen);
    manager.join('f1', wsClosing);
    manager.broadcast('f1', { tipo: 'test' });
    expect(wsOpen.send).toHaveBeenCalled();
    expect(wsClosing.send).not.toHaveBeenCalled();
  });

  it('broadcast não lança erro se room não existe', () => {
    expect(() => manager.broadcast('inexistente', { tipo: 'test' })).not.toThrow();
  });

  it('roomSize retorna 0 para room inexistente', () => {
    expect(manager.roomSize('inexistente')).toBe(0);
  });
});
