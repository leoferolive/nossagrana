import { describe, expect, it } from 'vitest';

import {
  ConflitoDeConcorrenciaError,
  traduzirConflitoDeConcorrencia,
  UnitOfWorkComConflitoTraduzido,
} from './conflito-concorrencia.js';
import { EfeitoPosCommitError } from './escopo-transacional.js';
import type { ContextoUnidadeDeTrabalho, UnitOfWork } from './unit-of-work.types.js';

/** Fake nomeada do erro do driver postgres-js (campo `code` = SQLSTATE). */
class ErroDoDriverFake extends Error {
  constructor(readonly code: string) {
    super(`erro do driver ${code} em UPDATE "cofrinhos" SET ...`);
  }
}

/** Fake nomeada do `DrizzleQueryError`: embrulha o erro do driver em `cause`. */
class ErroDoDrizzleFake extends Error {
  constructor(causa: Error) {
    super('Failed query: update "cofrinhos" set ...', { cause: causa });
  }
}

/** Fake nomeada: Unit of Work cujo trabalho sempre rejeita com `erro`. */
class UnitOfWorkQueRejeita implements UnitOfWork<object> {
  constructor(private readonly erro: unknown) {}

  async executar<T>(_trabalho: (c: ContextoUnidadeDeTrabalho<object>) => Promise<T>): Promise<T> {
    throw this.erro;
  }
}

describe('traduzirConflitoDeConcorrencia', () => {
  it.each([
    ['lock_timeout', '55P03'],
    ['deadlock', '40P01'],
    ['serialização', '40001'],
  ])('%s (%s) embrulhado pelo Drizzle vira erro de domínio sem SQL', (_caso, sqlstate) => {
    const traduzido = traduzirConflitoDeConcorrencia(
      new ErroDoDrizzleFake(new ErroDoDriverFake(sqlstate)),
    );

    expect(traduzido).toBeInstanceOf(ConflitoDeConcorrenciaError);
    expect((traduzido as ConflitoDeConcorrenciaError).sqlstate).toBe(sqlstate);
    expect((traduzido as Error).message).not.toMatch(/update|cofrinhos|SET/i);
  });

  it('conflito vindo de efeito pós-commit NÃO é traduzido: os dados já foram gravados', () => {
    const posCommit = new EfeitoPosCommitError(
      new ErroDoDrizzleFake(new ErroDoDriverFake('40P01')),
    );

    expect(traduzirConflitoDeConcorrencia(posCommit)).toBe(posCommit);
    expect(
      traduzirConflitoDeConcorrencia(new Error('embrulho', { cause: posCommit })),
    ).not.toBeInstanceOf(ConflitoDeConcorrenciaError);
  });

  it('outros erros (ex.: CHECK 23514, erro de domínio) passam intactos', () => {
    const check = new ErroDoDriverFake('23514');
    const dominio = new Error('Saldo insuficiente');

    expect(traduzirConflitoDeConcorrencia(check)).toBe(check);
    expect(traduzirConflitoDeConcorrencia(dominio)).toBe(dominio);
    expect(traduzirConflitoDeConcorrencia('texto')).toBe('texto');
  });
});

describe('UnitOfWorkComConflitoTraduzido', () => {
  it('traduz o conflito que a unidade interna propagou após o rollback', async () => {
    const uow = new UnitOfWorkComConflitoTraduzido(
      new UnitOfWorkQueRejeita(new ErroDoDriverFake('55P03')),
    );

    await expect(uow.executar(async () => 'nunca')).rejects.toBeInstanceOf(
      ConflitoDeConcorrenciaError,
    );
  });

  it('repassa resultado e erros de domínio sem alteração', async () => {
    const dominio = new Error('Cofrinho esta encerrado');
    const falha = new UnitOfWorkComConflitoTraduzido(new UnitOfWorkQueRejeita(dominio));
    const sucesso = new UnitOfWorkComConflitoTraduzido<object>({
      executar: (trabalho) => trabalho({ repos: {}, aoConfirmar: () => undefined }),
    });

    await expect(falha.executar(async () => 1)).rejects.toBe(dominio);
    await expect(sucesso.executar(async () => 42)).resolves.toBe(42);
  });
});
