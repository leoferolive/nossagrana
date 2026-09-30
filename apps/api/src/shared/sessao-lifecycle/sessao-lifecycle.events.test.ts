import EventEmitter from 'node:events';

import { describe, expect, it } from 'vitest';

import {
  ehSessoesRevogadasEvento,
  EventBusSessaoLifecyclePublisher,
  NoopSessaoLifecyclePublisher,
  SESSOES_REVOGADAS_EVENTO,
} from './sessao-lifecycle.events.js';

/** Fake nomeada do logger do Fastify: guarda os `error` para inspeção. */
class LogFake {
  readonly erros: Array<{ contexto: object; mensagem: string }> = [];

  error(contexto: object, mensagem: string): void {
    this.erros.push({ contexto, mensagem });
  }
}

describe('EventBusSessaoLifecyclePublisher (#119)', () => {
  it('publica só o userId no evento de sessões revogadas', () => {
    const eventBus = new EventEmitter();
    const recebidos: unknown[] = [];
    eventBus.on(SESSOES_REVOGADAS_EVENTO, (evento: unknown) => recebidos.push(evento));

    new EventBusSessaoLifecyclePublisher(eventBus, new LogFake()).sessoesRevogadas('user-1');

    expect(recebidos).toEqual([{ userId: 'user-1' }]);
  });

  it('engole e loga a falha de um listener: a revogação já gravada segue válida', () => {
    const eventBus = new EventEmitter();
    eventBus.on(SESSOES_REVOGADAS_EVENTO, () => {
      throw new Error('listener quebrado');
    });
    const log = new LogFake();

    expect(() =>
      new EventBusSessaoLifecyclePublisher(eventBus, log).sessoesRevogadas('user-1'),
    ).not.toThrow();

    expect(log.erros).toHaveLength(1);
    expect(log.erros[0].mensagem).toContain('user-1');
  });
});

describe('NoopSessaoLifecyclePublisher', () => {
  it('não faz nada', () => {
    expect(() => new NoopSessaoLifecyclePublisher().sessoesRevogadas()).not.toThrow();
  });
});

describe('ehSessoesRevogadasEvento', () => {
  it('aceita { userId: string } e rejeita o resto', () => {
    expect(ehSessoesRevogadasEvento({ userId: 'u' })).toBe(true);
    expect(ehSessoesRevogadasEvento({ userId: 1 })).toBe(false);
    expect(ehSessoesRevogadasEvento(null)).toBe(false);
    expect(ehSessoesRevogadasEvento('u')).toBe(false);
  });
});
