import type { FastifyBaseLogger } from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  logarSessoesNaoRevogadas,
  SessoesNaoRevogadasError,
} from './sessoes-nao-revogadas.error.js';

/** Fake nomeada do logger: só registra as chamadas de `error`. */
class LoggerFake {
  readonly chamadasDeErro: unknown[][] = [];
  error(...args: unknown[]): void {
    this.chamadasDeErro.push(args);
  }
}

describe('logarSessoesNaoRevogadas (#119)', () => {
  it('loga userId e causa quando a senha mudou mas a revogação falhou', () => {
    const logger = new LoggerFake();
    const causa = new Error('armazenamento indisponível');

    logarSessoesNaoRevogadas(
      logger as unknown as FastifyBaseLogger,
      new SessoesNaoRevogadasError('u1', causa),
    );

    expect(logger.chamadasDeErro).toHaveLength(1);
    expect(logger.chamadasDeErro[0]?.[0]).toEqual({ userId: 'u1', err: causa });
  });

  it('ignora outros erros (já tratados pelo handler global)', () => {
    const logger = new LoggerFake();

    logarSessoesNaoRevogadas(logger as unknown as FastifyBaseLogger, new Error('qualquer'));

    expect(logger.chamadasDeErro).toEqual([]);
  });
});
