import { describe, expect, it } from 'vitest';

import { IdempotenciaConflitoError } from '../../shared/idempotencia/idempotencia.errors.js';
import type {
  OpcoesIdempotencia,
  PedidoIdempotente,
} from '../../shared/idempotencia/idempotencia.types.js';
import { ReferenciasSempreValidasFake } from '../../shared/referencia-ownership/referencia-ownership.fakes.js';
import {
  FalhaInjetadaError,
  montarRepositoriosCofrinhoInMemory,
} from '../cofrinho/cofrinho.fakes.js';
import { InMemoryTemplateTransacaoRepository } from './template-transacao.repository.js';
import { TemplateTransacaoService } from './template-transacao.service.js';

/**
 * `aplicar` idempotente (#90): lançamentos, aportes e a chave numa única
 * unidade — falha em qualquer escrita não deixa lote parcial nem chave.
 */
type ResultadoAplicar = { transacoesCriadas: number; aportesCriados: number; total: number };

const pedido = (hashPayload = 'hash-1'): PedidoIdempotente => ({
  familiaId: 'f1',
  chave: 'chave-0001',
  operacao: 'POST /api/templates-transacao/aplicar',
  hashPayload,
});

const comChave = (p = pedido()): OpcoesIdempotencia<ResultadoAplicar> => ({
  pedido: p,
  responder: (valor) => ({ statusCode: 200, corpo: valor }),
});

/** 2 lançamentos + 2 aportes: reserva + 2 creates + 2×(saldo, create, movimentação) + resposta. */
const ESCRITAS_DO_LOTE = 10;

async function montar() {
  const ctx = montarRepositoriosCofrinhoInMemory();
  const templates = new InMemoryTemplateTransacaoRepository();
  const service = new TemplateTransacaoService(
    templates,
    ctx.instrumentada,
    ctx.buscarCategoriaCofrinho,
    new ReferenciasSempreValidasFake(),
  );
  const novoTemplate = (nome: string, extra: object) =>
    service.create({ familiaId: 'f1', nome, tipo: 'despesa', criadoPor: 'u1', ...extra });
  const cofrinhos = [
    (await ctx.cofrinhos.create({ familiaId: 'f1', nome: 'A', criadoPor: 'u1' })).id,
    (await ctx.cofrinhos.create({ familiaId: 'f1', nome: 'B', criadoPor: 'u1' })).id,
  ];
  const lote = [
    await novoTemplate('Luz', { categoriaId: 'c1' }),
    await novoTemplate('Água', { categoriaId: 'c1' }),
    await novoTemplate('Reserva A', { cofrinhoId: cofrinhos[0] }),
    await novoTemplate('Reserva B', { cofrinhoId: cofrinhos[1] }),
  ].map((t) => ({ templateId: t.id, valor: '10.00' }));
  const aplicar = (opcoes: OpcoesIdempotencia<ResultadoAplicar> | null, itens = lote) =>
    service.aplicarIdempotente(
      { familiaId: 'f1', usuarioId: 'u1', mesReferencia: '2026-03', itens },
      opcoes,
    );
  const estado = async () => ({
    transacoes: (await ctx.transacoes.list({ familiaId: 'f1' })).length,
    saldos: await Promise.all(
      cofrinhos.map(
        async (id) => (await ctx.cofrinhos.findById({ id, familiaId: 'f1' }))?.saldoAtual,
      ),
    ),
    chaves: ctx.idempotencia.chavesDa('f1'),
  });
  return { ctx, lote, aplicar, estado };
}

describe('TemplateTransacaoService.aplicarIdempotente (#90)', () => {
  it('replay devolve o resultado gravado sem gravar o lote de novo', async () => {
    const { aplicar, estado } = await montar();

    const primeira = await aplicar(comChave());
    const replay = await aplicar(comChave());

    const esperado = { transacoesCriadas: 2, aportesCriados: 2, total: 4 };
    expect(primeira).toEqual({ tipo: 'executada', valor: esperado });
    expect(replay).toEqual({ tipo: 'repetida', resposta: { statusCode: 200, corpo: esperado } });
    expect(await estado()).toEqual({
      transacoes: 4,
      saldos: ['10.00', '10.00'],
      chaves: ['chave-0001'],
    });
  });

  it('payload diferente com a mesma chave → IdempotenciaConflitoError, nada gravado', async () => {
    const { aplicar, estado, lote } = await montar();
    await aplicar(comChave());
    const antes = await estado();

    await expect(aplicar(comChave(pedido('hash-2')), lote.slice(0, 1))).rejects.toThrow(
      IdempotenciaConflitoError,
    );
    expect(await estado()).toEqual(antes);
  });

  it('sem chave (documentado): aplicar duas vezes grava o lote duas vezes', async () => {
    const { aplicar, estado } = await montar();

    await aplicar(null);
    await aplicar(null);

    expect(await estado()).toEqual({ transacoes: 8, saldos: ['20.00', '20.00'], chaves: [] });
  });

  it('escreve na ordem: reserva, lote, resposta', async () => {
    const { ctx, aplicar } = await montar();
    ctx.instrumentada.chamadas.length = 0;

    await aplicar(comChave());

    expect(ctx.instrumentada.chamadas).toHaveLength(ESCRITAS_DO_LOTE);
    expect(ctx.instrumentada.chamadas[0]).toBe('idempotencia.reservar');
    expect(ctx.instrumentada.chamadas.at(-1)).toBe('idempotencia.gravarResposta');
  });

  it.each(Array.from({ length: ESCRITAS_DO_LOTE }, (_, i) => i + 1))(
    'falha após a escrita %i: zero lançamentos, saldos intactos, sem chave; retry executa',
    async (n) => {
      const { ctx, aplicar, estado } = await montar();
      const antes = await estado();
      ctx.instrumentada.falharAposChamada(n);

      await expect(aplicar(comChave())).rejects.toBeInstanceOf(FalhaInjetadaError);
      expect(await estado()).toEqual(antes);

      ctx.instrumentada.falharAposChamada(Infinity);
      await expect(aplicar(comChave())).resolves.toMatchObject({ tipo: 'executada' });
      expect(await estado()).toMatchObject({ transacoes: 4, chaves: ['chave-0001'] });
    },
  );
});
