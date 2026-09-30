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
    manager.join('f1', ws, 'u1');
    expect(manager.roomSize('f1')).toBe(1);
  });

  it('leave remove socket do room', () => {
    const ws = mockSocket() as unknown as import('ws').WebSocket;
    manager.join('f1', ws, 'u1');
    manager.leave('f1', ws);
    expect(manager.roomSize('f1')).toBe(0);
  });

  it('broadcast envia mensagem a todos sockets OPEN do room', () => {
    const ws1 = mockSocket() as unknown as import('ws').WebSocket;
    const ws2 = mockSocket() as unknown as import('ws').WebSocket;
    manager.join('f1', ws1, 'u1');
    manager.join('f1', ws2, 'u1');
    manager.broadcast('f1', { tipo: 'transacao:alterada' });
    expect(ws1.send).toHaveBeenCalledWith(JSON.stringify({ tipo: 'transacao:alterada' }));
    expect(ws2.send).toHaveBeenCalledWith(JSON.stringify({ tipo: 'transacao:alterada' }));
  });

  it('broadcast ignora sockets não-OPEN (readyState !== 1)', () => {
    const wsOpen = mockSocket(1) as unknown as import('ws').WebSocket;
    const wsClosing = mockSocket(2) as unknown as import('ws').WebSocket;
    manager.join('f1', wsOpen, 'u1');
    manager.join('f1', wsClosing, 'u1');
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
      manager.join('f1', a.comoWebSocket(), 'u1');
      manager.join('f1', b.comoWebSocket(), 'u1');

      const fechados = manager.closeFamily('f1', 4004, 'Familia excluida');

      expect(fechados).toBe(2);
      expect(a.fechamento).toEqual({ codigo: 4004, motivo: 'Familia excluida' });
      expect(b.fechamento).toEqual({ codigo: 4004, motivo: 'Familia excluida' });
      expect(manager.roomSize('f1')).toBe(0);
    });

    it('não toca nos sockets de outra família (isolamento por familia_id)', () => {
      const alvo = new WebSocketFake();
      const outra = new WebSocketFake();
      manager.join('f1', alvo.comoWebSocket(), 'u1');
      manager.join('f2', outra.comoWebSocket(), 'u1');

      manager.closeFamily('f1', 4004, 'Familia excluida');

      expect(outra.fechamento).toBeNull();
      expect(manager.roomSize('f2')).toBe(1);
    });

    it('um socket que falha ao fechar não impede os demais; ele é terminado à força', () => {
      const quebrado = new WebSocketFake(true);
      const saudavel = new WebSocketFake();
      manager.join('f1', quebrado.comoWebSocket(), 'u1');
      manager.join('f1', saudavel.comoWebSocket(), 'u1');

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

  describe('closeUser (#119)', () => {
    it('fecha os sockets do usuário em todas as famílias e só os dele', () => {
      const anaF1 = new WebSocketFake();
      const anaF2 = new WebSocketFake();
      const bruno = new WebSocketFake();
      manager.join('f1', anaF1.comoWebSocket(), 'ana');
      manager.join('f2', anaF2.comoWebSocket(), 'ana');
      manager.join('f1', bruno.comoWebSocket(), 'bruno');

      const fechados = manager.closeUser('ana', 4005, 'Sessao revogada');

      expect(fechados).toBe(2);
      expect(anaF1.fechamento).toEqual({ codigo: 4005, motivo: 'Sessao revogada' });
      expect(anaF2.fechamento).toEqual({ codigo: 4005, motivo: 'Sessao revogada' });
      expect(bruno.fechamento).toBeNull();
      expect(manager.roomSize('f1')).toBe(1);
      expect(manager.roomSize('f2')).toBe(0);
    });

    it('um socket que falha ao fechar é terminado à força sem impedir os demais', () => {
      const quebrado = new WebSocketFake(true);
      const saudavel = new WebSocketFake();
      manager.join('f1', quebrado.comoWebSocket(), 'ana');
      manager.join('f2', saudavel.comoWebSocket(), 'ana');

      expect(manager.closeUser('ana', 4005, 'Sessao revogada')).toBe(2);

      expect(quebrado.encerradoPorTerminate).toBe(true);
      expect(saudavel.fechamento).toEqual({ codigo: 4005, motivo: 'Sessao revogada' });
    });

    it('retorna 0 para usuário sem sockets', () => {
      expect(manager.closeUser('ninguem', 4005, 'Sessao revogada')).toBe(0);
    });

    it('depois de fechar, o usuário não recebe mais broadcast', () => {
      const ana = new WebSocketFake();
      manager.join('f1', ana.comoWebSocket(), 'ana');
      manager.closeUser('ana', 4005, 'Sessao revogada');

      manager.broadcast('f1', { tipo: 'transacao:alterada' });

      expect(ana.enviadas).toEqual([]);
    });
  });

  describe('closeUserInFamily (#119)', () => {
    it('fecha só os sockets do usuário naquela família (membership removida)', () => {
      const anaF1 = new WebSocketFake();
      const anaF2 = new WebSocketFake();
      const brunoF1 = new WebSocketFake();
      manager.join('f1', anaF1.comoWebSocket(), 'ana');
      manager.join('f2', anaF2.comoWebSocket(), 'ana');
      manager.join('f1', brunoF1.comoWebSocket(), 'bruno');

      const fechados = manager.closeUserInFamily('f1', 'ana', 4006, 'Membro removido');

      expect(fechados).toBe(1);
      expect(anaF1.fechamento).toEqual({ codigo: 4006, motivo: 'Membro removido' });
      expect(anaF2.fechamento).toBeNull();
      expect(brunoF1.fechamento).toBeNull();
      expect(manager.roomSize('f1')).toBe(1);
      expect(manager.roomSize('f2')).toBe(1);
    });

    it('fecha todas as conexões do usuário na família (vários dispositivos)', () => {
      const a = new WebSocketFake();
      const b = new WebSocketFake();
      manager.join('f1', a.comoWebSocket(), 'ana');
      manager.join('f1', b.comoWebSocket(), 'ana');

      expect(manager.closeUserInFamily('f1', 'ana', 4006, 'Membro removido')).toBe(2);
    });

    it('retorna 0 para família sem sockets', () => {
      expect(manager.closeUserInFamily('inexistente', 'ana', 4006, 'Membro removido')).toBe(0);
    });
  });
});
