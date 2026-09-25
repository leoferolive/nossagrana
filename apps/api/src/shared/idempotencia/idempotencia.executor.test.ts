import { describe, expect, it } from 'vitest';

import { InMemoryUnitOfWork } from '../unit-of-work/in-memory-unit-of-work.js';
import { IdempotenciaConflitoError } from './idempotencia.errors.js';
import { executarComIdempotencia } from './idempotencia.executor.js';
import { InMemoryIdempotenciaRepository } from './idempotencia.repository.js';
import type { OpcoesIdempotencia, PedidoIdempotente } from './idempotencia.types.js';

const pedido: PedidoIdempotente = {
  familiaId: 'fA',
  chave: 'chave-0001',
  operacao: 'POST /api/transacoes',
  hashPayload: 'hash-1',
};

/** Fake nomeada da operação protegida: conta execuções e devolve um id por execução. */
class OperacaoContada {
  execucoes = 0;
  executar = async (): Promise<{ id: string }> => {
    this.execucoes++;
    return { id: `t${this.execucoes}` };
  };
}

const opcoes = (p: PedidoIdempotente = pedido): OpcoesIdempotencia<{ id: string }> => ({
  pedido: p,
  responder: (valor) => ({ statusCode: 201, corpo: { transacao: valor } }),
});

describe('executarComIdempotencia', () => {
  it('1ª execução roda a operação e grava a resposta 2xx', async () => {
    const repo = new InMemoryIdempotenciaRepository();
    const operacao = new OperacaoContada();

    const resultado = await executarComIdempotencia(repo, opcoes(), operacao.executar);

    expect(resultado).toEqual({ tipo: 'executada', valor: { id: 't1' } });
    expect(await repo.reservar(pedido)).toMatchObject({
      existente: { resposta: { statusCode: 201, corpo: { transacao: { id: 't1' } } } },
    });
  });

  it('replay (mesma operação e payload) devolve a resposta gravada sem executar de novo', async () => {
    const repo = new InMemoryIdempotenciaRepository();
    const operacao = new OperacaoContada();
    await executarComIdempotencia(repo, opcoes(), operacao.executar);

    const replay = await executarComIdempotencia(repo, opcoes(), operacao.executar);

    expect(replay).toEqual({
      tipo: 'repetida',
      resposta: { statusCode: 201, corpo: { transacao: { id: 't1' } } },
    });
    expect(operacao.execucoes).toBe(1);
  });

  it.each([
    ['payload diferente', { ...pedido, hashPayload: 'hash-2' }],
    ['operação diferente', { ...pedido, operacao: 'POST /api/templates-transacao/aplicar' }],
  ])('mesma chave com %s → IdempotenciaConflitoError (422), sem executar', async (_c, outro) => {
    const repo = new InMemoryIdempotenciaRepository();
    const operacao = new OperacaoContada();
    await executarComIdempotencia(repo, opcoes(), operacao.executar);

    const erro = await executarComIdempotencia(repo, opcoes(outro), operacao.executar).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(IdempotenciaConflitoError);
    expect(erro).toMatchObject({ statusHttp: 422, code: 'IDEMPOTENCIA_CONFLITO' });
    expect(operacao.execucoes).toBe(1);
  });

  it('sem chave (opções null): executa sempre — duas chamadas iguais executam duas vezes', async () => {
    const repo = new InMemoryIdempotenciaRepository();
    const operacao = new OperacaoContada();

    await executarComIdempotencia(repo, null, operacao.executar);
    await executarComIdempotencia(repo, null, operacao.executar);

    expect(operacao.execucoes).toBe(2);
    expect(repo.chavesDa('fA')).toEqual([]);
  });

  it('dentro da Unit of Work: falha na operação desfaz a reserva e o retry executa', async () => {
    const idempotencia = new InMemoryIdempotenciaRepository();
    const uow = new InMemoryUnitOfWork({ idempotencia });
    const operacao = new OperacaoContada();
    const falha = async () => {
      throw new Error('falha no insert nº 2');
    };

    await expect(
      uow.executar(({ repos }) => executarComIdempotencia(repos.idempotencia, opcoes(), falha)),
    ).rejects.toThrow('insert nº 2');
    expect(idempotencia.chavesDa('fA')).toEqual([]);

    const retry = await uow.executar(({ repos }) =>
      executarComIdempotencia(repos.idempotencia, opcoes(), operacao.executar),
    );
    expect(retry.tipo).toBe('executada');
    expect(operacao.execucoes).toBe(1);
  });

  it('resposta não-2xx do responder é erro de programação: não grava e falha', async () => {
    const repo = new InMemoryIdempotenciaRepository();
    const erroHttp: OpcoesIdempotencia<{ id: string }> = {
      pedido,
      responder: () => ({ statusCode: 400, corpo: {} }),
    };

    await expect(
      executarComIdempotencia(repo, erroHttp, new OperacaoContada().executar),
    ).rejects.toThrow(/status 400 recebido, esperado 2xx/);
  });

  it('registro confirmado sem resposta (estado impossível após commit) falha sem executar', async () => {
    const repo = new InMemoryIdempotenciaRepository();
    await repo.reservar(pedido);
    const operacao = new OperacaoContada();

    await expect(executarComIdempotencia(repo, opcoes(), operacao.executar)).rejects.toThrow(
      /"chave-0001" da família fA sem resposta gravada/,
    );
    expect(operacao.execucoes).toBe(0);
  });
});
