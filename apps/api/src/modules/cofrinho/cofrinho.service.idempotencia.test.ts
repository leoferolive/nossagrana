import { describe, expect, it } from 'vitest';

import { IdempotenciaConflitoError } from '../../shared/idempotencia/idempotencia.errors.js';
import type {
  OpcoesIdempotencia,
  PedidoIdempotente,
} from '../../shared/idempotencia/idempotencia.types.js';
import {
  FalhaInjetadaError,
  montarCofrinhoServiceInMemory,
  type CofrinhoServiceInMemory,
} from './cofrinho.fakes.js';
import { reconciliarSaldo } from './cofrinho.reconciliacao.js';
import type { ResultadoMovimentacao } from './cofrinho.types.js';

/**
 * Idempotência de aporte e retirada (#90): a chave é a 1ª escrita da unidade
 * do saldo — replay não mexe no saldo, falha em qualquer escrita não deixa
 * saldo/ledger/transação nem chave, e o retry com a mesma chave executa.
 */
const pedido = (operacao: string, hashPayload = 'hash-1'): PedidoIdempotente => ({
  familiaId: 'fA',
  chave: 'chave-0001',
  operacao,
  hashPayload,
});

const comChave = (p: PedidoIdempotente): OpcoesIdempotencia<ResultadoMovimentacao> => ({
  pedido: p,
  responder: ({ cofrinho, movimentacao }) => ({
    statusCode: 201,
    corpo: { saldo: cofrinho.saldoAtual, movimentacaoId: movimentacao.id },
  }),
});

async function cofrinhoCom100(ctx: CofrinhoServiceInMemory) {
  const { id } = await ctx.service.criar({ familiaId: 'fA', nome: 'Viagem', criadoPor: 'uA' });
  await ctx.service.aportar({
    cofrinhoId: id,
    familiaId: 'fA',
    valor: '100.00',
    registradoPor: 'uA',
  });
  return id;
}

async function estado(ctx: CofrinhoServiceInMemory, cofrinhoId: string) {
  const cofrinho = await ctx.cofrinhos.findById({ id: cofrinhoId, familiaId: 'fA' });
  const ledger = await ctx.movimentacoes.listByCofrinho({ cofrinhoId, familiaId: 'fA' });
  return {
    saldo: cofrinho?.saldoAtual,
    movimentacoes: ledger.length,
    transacoes: (await ctx.transacoes.list({ familiaId: 'fA' })).length,
    chaves: ctx.idempotencia.chavesDa('fA'),
    reconciliado: cofrinho ? reconciliarSaldo(cofrinho, ledger).consistente : false,
  };
}

type Operacao = (
  ctx: CofrinhoServiceInMemory,
  cofrinhoId: string,
  opcoes: OpcoesIdempotencia<ResultadoMovimentacao> | null,
) => Promise<unknown>;

const aportar: Operacao = (ctx, cofrinhoId, opcoes) =>
  ctx.service.aportarIdempotente(
    { cofrinhoId, familiaId: 'fA', valor: '40.00', registradoPor: 'uA' },
    opcoes,
  );

const retirar: Operacao = (ctx, cofrinhoId, opcoes) =>
  ctx.service.retirarIdempotente(
    { cofrinhoId, familiaId: 'fA', valor: '40.00', voltarAoSaldo: true, registradoPor: 'uA' },
    opcoes,
  );

/** [nome, operação, rota, saldo depois de UMA execução, escritas na unidade com chave] */
const cenarios: Array<[string, Operacao, string, string, number]> = [
  ['aporte', aportar, 'POST /api/cofrinhos/:id/aportes', '140.00', 5],
  ['retirada com voltarAoSaldo', retirar, 'POST /api/cofrinhos/:id/retiradas', '60.00', 5],
];

describe.each(cenarios)(
  'CofrinhoService — %s idempotente (#90)',
  (_n, operar, rota, saldo, escritas) => {
    it('replay devolve a resposta gravada e o saldo muda uma única vez', async () => {
      const ctx = montarCofrinhoServiceInMemory();
      const id = await cofrinhoCom100(ctx);

      const primeira = await operar(ctx, id, comChave(pedido(rota)));
      const replay = await operar(ctx, id, comChave(pedido(rota)));

      expect(primeira).toMatchObject({ tipo: 'executada' });
      expect(replay).toMatchObject({
        tipo: 'repetida',
        resposta: { statusCode: 201, corpo: { saldo } },
      });
      expect(await estado(ctx, id)).toMatchObject({ saldo, movimentacoes: 2, reconciliado: true });
    });

    it('mesma chave com payload diferente → IdempotenciaConflitoError, saldo intacto', async () => {
      const ctx = montarCofrinhoServiceInMemory();
      const id = await cofrinhoCom100(ctx);
      await operar(ctx, id, comChave(pedido(rota)));
      const antes = await estado(ctx, id);

      await expect(operar(ctx, id, comChave(pedido(rota, 'hash-2')))).rejects.toThrow(
        IdempotenciaConflitoError,
      );
      expect(await estado(ctx, id)).toEqual(antes);
    });

    it('sem chave (documentado): dois envios iguais movimentam o saldo duas vezes', async () => {
      const ctx = montarCofrinhoServiceInMemory();
      const id = await cofrinhoCom100(ctx);

      await operar(ctx, id, null);
      await operar(ctx, id, null);

      expect(await estado(ctx, id)).toMatchObject({
        movimentacoes: 3,
        chaves: [],
        reconciliado: true,
      });
    });

    it('grava na ordem: reserva da chave, efeitos do saldo, resposta', async () => {
      const ctx = montarCofrinhoServiceInMemory();
      const id = await cofrinhoCom100(ctx);
      ctx.instrumentada.chamadas.length = 0;

      await operar(ctx, id, comChave(pedido(rota)));

      expect(ctx.instrumentada.chamadas).toHaveLength(escritas);
      expect(ctx.instrumentada.chamadas[0]).toBe('idempotencia.reservar');
      expect(ctx.instrumentada.chamadas.at(-1)).toBe('idempotencia.gravarResposta');
    });

    it.each(Array.from({ length: escritas }, (_, i) => i + 1))(
      'falha após a escrita %i: nada gravado (nem chave); retry com a mesma chave executa',
      async (n) => {
        const ctx = montarCofrinhoServiceInMemory();
        const id = await cofrinhoCom100(ctx);
        const antes = await estado(ctx, id);
        ctx.instrumentada.falharAposChamada(n);

        await expect(operar(ctx, id, comChave(pedido(rota)))).rejects.toBeInstanceOf(
          FalhaInjetadaError,
        );
        expect(await estado(ctx, id)).toEqual(antes);

        ctx.instrumentada.falharAposChamada(Infinity);
        await expect(operar(ctx, id, comChave(pedido(rota)))).resolves.toMatchObject({
          tipo: 'executada',
        });
        expect(await estado(ctx, id)).toMatchObject({ saldo, chaves: ['chave-0001'] });
      },
    );
  },
);

describe('CofrinhoService — chave de idempotência por família', () => {
  it('mesma chave em outra família não é replay: execução independente', async () => {
    const ctx = montarCofrinhoServiceInMemory();
    const idA = await cofrinhoCom100(ctx);
    const { id: idB } = await ctx.service.criar({ familiaId: 'fB', nome: 'B', criadoPor: 'uB' });
    const rota = 'POST /api/cofrinhos/:id/aportes';
    await aportar(ctx, idA, comChave(pedido(rota)));

    const deB = await ctx.service.aportarIdempotente(
      { cofrinhoId: idB, familiaId: 'fB', valor: '40.00', registradoPor: 'uB' },
      comChave({ ...pedido(rota), familiaId: 'fB' }),
    );

    expect(deB.tipo).toBe('executada');
    expect(ctx.idempotencia.chavesDa('fB')).toEqual(['chave-0001']);
    expect(ctx.idempotencia.chavesDa('fA')).toEqual(['chave-0001']);
  });
});
