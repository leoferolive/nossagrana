import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketFake } from './tests/websocket-fake.js';
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
  describe('closeFamily', () => {
    it('fecha todos os sockets da família com código e motivo e esvazia o room', () => {
      const a = new WebSocketFake();
      const b = new WebSocketFake();
      manager.join('f1', a.comoWebSocket());
      manager.join('f1', b.comoWebSocket());

      const fechados = manager.closeFamily('f1', 4004, 'Familia excluida');

      expect(fechados).toBe(2);
      expect(a.fechamento).toEqual({ codigo: 4004, motivo: 'Familia excluida' });
      expect(b.fechamento).toEqual({ codigo: 4004, motivo: 'Familia excluida' });
      expect(manager.roomSize('f1')).toBe(0);
    });

    it('não toca nos sockets de outra família (isolamento por familia_id)', () => {
      const alvo = new WebSocketFake();
      const outra = new WebSocketFake();
      manager.join('f1', alvo.comoWebSocket());
      manager.join('f2', outra.comoWebSocket());

      manager.closeFamily('f1', 4004, 'Familia excluida');

      expect(outra.fechamento).toBeNull();
      expect(manager.roomSize('f2')).toBe(1);
    });

    it('um socket que falha ao fechar não impede os demais; ele é terminado à força', () => {
      const quebrado = new WebSocketFake(true);
      const saudavel = new WebSocketFake();
      manager.join('f1', quebrado.comoWebSocket());
      manager.join('f1', saudavel.comoWebSocket());

      const fechados = manager.closeFamily('f1', 4004, 'Familia excluida');

      expect(fechados).toBe(2);
      expect(quebrado.encerradoPorTerminate).toBe(true);
      expect(saudavel.fechamento).toEqual({ codigo: 4004, motivo: 'Familia excluida' });
      expect(manager.roomSize('f1')).toBe(0);
    });

    it('não lança e retorna 0 para família sem sockets', () => {
      expect(manager.closeFamily('inexistente', 4004, 'Familia excluida')).toBe(0);
    });
  });
});
