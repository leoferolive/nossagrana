import { describe, expect, it } from 'vitest';

import { CofrinhoNotFoundError, SaldoInsuficienteError } from './cofrinho.errors.js';
import {
  FalhaInjetadaError,
  montarCofrinhoServiceInMemory,
  type CofrinhoServiceInMemory,
  type PontoDeFalha,
} from './cofrinho.fakes.js';
import { reconciliarSaldo } from './cofrinho.reconciliacao.js';

/**
 * Atomicidade de aporte/retirada/encerramento (#60–#62) com a
 * InMemoryUnitOfWork: a falha é injetada DEPOIS de cada escrita concluir, e o
 * estado publicado precisa ficar idêntico ao de antes (nenhuma escrita parcial).
 */

async function cofrinhoComSaldo(ctx: CofrinhoServiceInMemory, saldo: string | null) {
  const cofrinho = await ctx.service.criar({ familiaId: 'fA', nome: 'Viagem', criadoPor: 'uA' });
  if (saldo) {
    await ctx.service.aportar({
      cofrinhoId: cofrinho.id,
      familiaId: 'fA',
      valor: saldo,
      registradoPor: 'uA',
    });
  }
  return cofrinho.id;
}

async function estado(ctx: CofrinhoServiceInMemory, cofrinhoId: string) {
  const cofrinho = await ctx.cofrinhos.findById({ id: cofrinhoId, familiaId: 'fA' });
  const ledger = await ctx.movimentacoes.listByCofrinho({ cofrinhoId, familiaId: 'fA' });
  const transacoes = await ctx.transacoes.list({ familiaId: 'fA' });
  return {
    saldo: cofrinho?.saldoAtual,
    status: cofrinho?.status,
    movimentacoes: ledger.length,
    transacoes: transacoes.length,
    reconciliado: cofrinho ? reconciliarSaldo(cofrinho, ledger).consistente : false,
  };
}

type Operacao = (ctx: CofrinhoServiceInMemory, cofrinhoId: string) => Promise<unknown>;

const aportar: Operacao = (ctx, cofrinhoId) =>
  ctx.service.aportar({ cofrinhoId, familiaId: 'fA', valor: '40.00', registradoPor: 'uA' });

const retirarComRetorno: Operacao = (ctx, cofrinhoId) =>
  ctx.service.retirar({
    cofrinhoId,
    familiaId: 'fA',
    valor: '40.00',
    voltarAoSaldo: true,
    registradoPor: 'uA',
  });

const encerrarComRetorno: Operacao = (ctx, id) =>
  ctx.service.encerrar({ id, familiaId: 'fA', voltarAoSaldo: true, registradoPor: 'uA' });

const cenarios: Array<[string, Operacao, PontoDeFalha[]]> = [
  ['aporte', aportar, ['cofrinhos.incrementarSaldo', 'transacoes.create', 'movimentacoes.create']],
  [
    'retirada com voltarAoSaldo',
    retirarComRetorno,
    ['cofrinhos.decrementarSaldo', 'transacoes.create', 'movimentacoes.create'],
  ],
  [
    'encerramento com voltarAoSaldo',
    encerrarComRetorno,
    [
      'cofrinhos.bloquearParaAtualizacao',
      'cofrinhos.decrementarSaldo',
      'transacoes.create',
      'movimentacoes.create',
      'cofrinhos.encerrar',
    ],
  ],
];

describe('CofrinhoService — atomicidade com falha injetada', () => {
  describe.each(cenarios)('%s', (_nome, operacao, pontos) => {
    it('grava na ordem esperada numa única unidade', async () => {
      const ctx = montarCofrinhoServiceInMemory();
      const cofrinhoId = await cofrinhoComSaldo(ctx, '100.00');
      ctx.instrumentada.chamadas.length = 0;

      await operacao(ctx, cofrinhoId);

      const escritas = ctx.instrumentada.chamadas.filter((c) => pontos.includes(c as PontoDeFalha));
      expect(escritas).toEqual(pontos);
      expect(await estado(ctx, cofrinhoId)).toMatchObject({ reconciliado: true });
    });

    it.each(pontos)('falha após %s não deixa nada gravado', async (ponto) => {
      const ctx = montarCofrinhoServiceInMemory();
      const cofrinhoId = await cofrinhoComSaldo(ctx, '100.00');
      const antes = await estado(ctx, cofrinhoId);
      ctx.instrumentada.falharApos(ponto);

      await expect(operacao(ctx, cofrinhoId)).rejects.toBeInstanceOf(FalhaInjetadaError);

      expect(await estado(ctx, cofrinhoId)).toEqual(antes);
      expect(antes.reconciliado).toBe(true);
    });
  });
});

describe('CofrinhoService — invariantes de saldo', () => {
  it('aporte confirmado aumenta o saldo exatamente uma vez e casa com o ledger', async () => {
    const ctx = montarCofrinhoServiceInMemory();
    const cofrinhoId = await cofrinhoComSaldo(ctx, null);

    for (let i = 0; i < 5; i++) await aportar(ctx, cofrinhoId);

    expect(await estado(ctx, cofrinhoId)).toMatchObject({
      saldo: '200.00',
      movimentacoes: 5,
      transacoes: 5,
      reconciliado: true,
    });
  });

  it('retirada acima do saldo é rejeitada sem transação de retorno nem movimentação', async () => {
    const ctx = montarCofrinhoServiceInMemory();
    const cofrinhoId = await cofrinhoComSaldo(ctx, '39.99');
    const antes = await estado(ctx, cofrinhoId);
    ctx.instrumentada.chamadas.length = 0;

    await expect(retirarComRetorno(ctx, cofrinhoId)).rejects.toThrow(SaldoInsuficienteError);

    expect(ctx.instrumentada.chamadas).not.toContain('transacoes.create');
    expect(ctx.instrumentada.chamadas).not.toContain('movimentacoes.create');
    expect(await estado(ctx, cofrinhoId)).toEqual(antes);
  });

  it.each([
    ['aporte', aportar],
    ['retirada', retirarComRetorno],
    ['encerramento', encerrarComRetorno],
  ] as const)(
    '%s em cofrinho de outra família é "não encontrado" e não altera a família A',
    async (_n, operacao) => {
      const ctx = montarCofrinhoServiceInMemory();
      const cofrinhoDeA = await cofrinhoComSaldo(ctx, '100.00');
      const antes = await estado(ctx, cofrinhoDeA);
      const comoFamiliaB: typeof ctx = {
        ...ctx,
        service: new Proxy(ctx.service, {
          get: (alvo, prop) => {
            const metodo = Reflect.get(alvo, prop) as (input: object) => Promise<unknown>;
            return (input: object) => metodo.call(alvo, { ...input, familiaId: 'fB' });
          },
        }),
      };

      await expect(operacao(comoFamiliaB, cofrinhoDeA)).rejects.toThrow(CofrinhoNotFoundError);
      expect(await estado(ctx, cofrinhoDeA)).toEqual(antes);
      expect(await ctx.transacoes.list({ familiaId: 'fB' })).toEqual([]);
    },
  );
});
