import { beforeEach, describe, expect, it } from 'vitest';

import {
  AporteRecorrenteIndisponivelError,
  AporteRecorrenteJaAtivoError,
  AporteRecorrenteNotFoundError,
  CancelamentoRecorrenteIndisponivelError,
  CofrinhoEncerradoError,
  CofrinhoNotFoundError,
  SaldoInsuficienteError,
} from './cofrinho.errors.js';
import {
  CATEGORIA_COFRINHO_FAKE,
  montarCofrinhoServiceInMemory,
  TransacaoRecorrenteCreatorFake,
  type CofrinhoServiceInMemory,
} from './cofrinho.fakes.js';

describe('CofrinhoService', () => {
  let ctx: CofrinhoServiceInMemory;

  beforeEach(() => {
    ctx = montarCofrinhoServiceInMemory();
  });

  const criar = (familiaId = 'f1') =>
    ctx.service.criar({ familiaId, nome: 'Viagem', criadoPor: 'u1' });

  const aportar = (cofrinhoId: string, valor: string, extra: Record<string, unknown> = {}) =>
    ctx.service.aportar({ cofrinhoId, familiaId: 'f1', valor, registradoPor: 'u1', ...extra });

  const transacoesDe = (familiaId = 'f1') => ctx.transacoes.list({ familiaId });

  describe('criar', () => {
    it('deve criar cofrinho com nome, emoji e meta', async () => {
      const result = await ctx.service.criar({
        familiaId: 'f1',
        nome: 'Viagem',
        emoji: '✈️',
        metaValor: '5000.00',
        criadoPor: 'u1',
      });

      expect(result).toMatchObject({
        nome: 'Viagem',
        emoji: '✈️',
        metaValor: '5000.00',
        saldoAtual: '0',
        status: 'ativo',
        familiaId: 'f1',
        criadoPor: 'u1',
      });
    });

    it('deve criar cofrinho sem emoji e sem meta', async () => {
      const result = await criar();

      expect(result.emoji).toBeNull();
      expect(result.metaValor).toBeNull();
    });
  });

  describe('editar', () => {
    it('deve atualizar nome e meta', async () => {
      const cofrinho = await criar();

      const updated = await ctx.service.editar({
        id: cofrinho.id,
        familiaId: 'f1',
        nome: 'Viagem Europa',
        metaValor: '10000.00',
      });

      expect(updated.nome).toBe('Viagem Europa');
      expect(updated.metaValor).toBe('10000.00');
    });

    it('deve rejeitar se não encontrado', async () => {
      await expect(
        ctx.service.editar({ id: 'inexistente', familiaId: 'f1', nome: 'X' }),
      ).rejects.toThrow(CofrinhoNotFoundError);
    });

    it('deve rejeitar se encerrado', async () => {
      const cofrinho = await criar();
      await ctx.cofrinhos.encerrar({ id: cofrinho.id, familiaId: 'f1' });

      await expect(
        ctx.service.editar({ id: cofrinho.id, familiaId: 'f1', nome: 'X' }),
      ).rejects.toThrow(CofrinhoEncerradoError);
    });
  });

  describe('aportar (simples)', () => {
    it('deve criar transação de despesa + movimentação + incrementar saldo', async () => {
      const cofrinho = await criar();

      const result = await aportar(cofrinho.id, '500.00', { descricao: 'Primeiro aporte' });

      expect(result.cofrinho.saldoAtual).toBe('500.00');
      expect(result.movimentacao).toMatchObject({
        tipo: 'aporte',
        valor: '500.00',
        descricao: 'Primeiro aporte',
      });
      const [transacao] = await transacoesDe();
      expect(transacao).toMatchObject({
        id: result.movimentacao.transacaoId,
        tipo: 'despesa',
        valor: '500.00',
        categoriaId: CATEGORIA_COFRINHO_FAKE,
        familiaId: 'f1',
        cofrinhoId: cofrinho.id,
      });
    });

    it('deve acumular saldo em múltiplos aportes', async () => {
      const cofrinho = await criar();

      await aportar(cofrinho.id, '100.50');
      const result = await aportar(cofrinho.id, '200.75');

      expect(result.cofrinho.saldoAtual).toBe('301.25');
    });

    it('usa mesReferencia e data fornecidos', async () => {
      const cofrinho = await criar();

      const result = await aportar(cofrinho.id, '300.00', {
        mesReferencia: '2026-01',
        data: '2026-01-15',
      });

      expect(result.movimentacao.mesReferencia).toBe('2026-01');
      const [transacao] = await transacoesDe();
      expect(transacao).toMatchObject({ mesReferencia: '2026-01', data: '2026-01-15' });
    });

    it('deve rejeitar se cofrinho não encontrado', async () => {
      await expect(aportar('inexistente', '100.00')).rejects.toThrow(CofrinhoNotFoundError);
    });

    it('deve rejeitar se cofrinho encerrado', async () => {
      const cofrinho = await criar();
      await ctx.cofrinhos.encerrar({ id: cofrinho.id, familiaId: 'f1' });

      await expect(aportar(cofrinho.id, '100.00')).rejects.toThrow(CofrinhoEncerradoError);
    });
  });

  describe('retirar', () => {
    const retirar = (cofrinhoId: string, valor: string, voltarAoSaldo: boolean) =>
      ctx.service.retirar({
        cofrinhoId,
        familiaId: 'f1',
        valor,
        descricao: 'Comprei passagem',
        voltarAoSaldo,
        registradoPor: 'u1',
      });

    it('com voltarAoSaldo=true: cria transação de receita + movimentação + decrementa saldo', async () => {
      const cofrinho = await criar();
      await aportar(cofrinho.id, '1000.00');

      const result = await retirar(cofrinho.id, '300.00', true);

      expect(result.cofrinho.saldoAtual).toBe('700.00');
      expect(result.movimentacao).toMatchObject({ tipo: 'retirada', valor: '300.00' });
      const receita = (await transacoesDe()).find((t) => t.tipo === 'receita');
      expect(receita).toMatchObject({
        id: result.movimentacao.transacaoId,
        valor: '300.00',
        categoriaId: CATEGORIA_COFRINHO_FAKE,
      });
    });

    it('com voltarAoSaldo=false: apenas movimentação, sem transação', async () => {
      const cofrinho = await criar();
      await aportar(cofrinho.id, '1000.00');

      const result = await retirar(cofrinho.id, '300.00', false);

      expect(result.cofrinho.saldoAtual).toBe('700.00');
      expect(result.movimentacao.transacaoId).toBeNull();
      expect(await transacoesDe()).toHaveLength(1); // só a do aporte
    });

    it('retirada do saldo exato zera o cofrinho', async () => {
      const cofrinho = await criar();
      await aportar(cofrinho.id, '100.00');

      const result = await retirar(cofrinho.id, '100.00', false);

      expect(result.cofrinho.saldoAtual).toBe('0.00');
    });

    it('deve rejeitar se saldo insuficiente, citando o valor pedido', async () => {
      const cofrinho = await criar();
      await aportar(cofrinho.id, '100.00');

      const erro = await retirar(cofrinho.id, '200.00', true).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(SaldoInsuficienteError);
      expect((erro as Error).message).toContain('200.00');
    });

    it('deve rejeitar se cofrinho não encontrado', async () => {
      await expect(retirar('inexistente', '100.00', true)).rejects.toThrow(CofrinhoNotFoundError);
    });

    it('deve rejeitar se cofrinho encerrado', async () => {
      const cofrinho = await criar();
      await aportar(cofrinho.id, '500.00');
      await ctx.cofrinhos.encerrar({ id: cofrinho.id, familiaId: 'f1' });

      await expect(retirar(cofrinho.id, '100.00', true)).rejects.toThrow(CofrinhoEncerradoError);
    });
  });

  describe('encerrar', () => {
    const encerrar = (id: string, voltarAoSaldo: boolean) =>
      ctx.service.encerrar({ id, familiaId: 'f1', voltarAoSaldo, registradoPor: 'u1' });

    it('com saldo 0: muda status para encerrado', async () => {
      const cofrinho = await criar();

      const result = await encerrar(cofrinho.id, false);

      expect(result.status).toBe('encerrado');
      expect(result.encerradoEm).not.toBeNull();
    });

    it('com saldo > 0 e voltarAoSaldo=true: cria retirada total + receita + encerra', async () => {
      const cofrinho = await criar();
      await aportar(cofrinho.id, '500.00');

      const result = await encerrar(cofrinho.id, true);

      expect(result.status).toBe('encerrado');
      expect(parseFloat(result.saldoAtual)).toBe(0);
      const receita = (await transacoesDe()).find((t) => t.tipo === 'receita');
      expect(receita?.valor).toBe('500.00');
    });

    it('com saldo > 0 e voltarAoSaldo=false: zera saldo por retirada no ledger + encerra', async () => {
      const cofrinho = await criar();
      await aportar(cofrinho.id, '500.00');

      const result = await encerrar(cofrinho.id, false);

      expect(parseFloat(result.saldoAtual)).toBe(0);
      expect(await transacoesDe()).toHaveLength(1); // só a do aporte
      const ledger = await ctx.movimentacoes.listByCofrinho({
        cofrinhoId: cofrinho.id,
        familiaId: 'f1',
      });
      expect(ledger.map((m) => m.tipo).sort()).toEqual(['aporte', 'retirada']);
    });

    it('deve rejeitar se não encontrado', async () => {
      await expect(encerrar('inexistente', false)).rejects.toThrow(CofrinhoNotFoundError);
    });

    it('deve rejeitar se já encerrado', async () => {
      const cofrinho = await criar();
      await ctx.cofrinhos.encerrar({ id: cofrinho.id, familiaId: 'f1' });

      await expect(encerrar(cofrinho.id, false)).rejects.toThrow(CofrinhoEncerradoError);
    });
  });

  describe('listar e detalhe', () => {
    it('filtra por status e isola por familiaId', async () => {
      const c1 = await criar();
      await ctx.service.criar({ familiaId: 'f1', nome: 'Emergência', criadoPor: 'u1' });
      await ctx.service.criar({ familiaId: 'f2', nome: 'Carro', criadoPor: 'u2' });
      await ctx.service.encerrar({
        id: c1.id,
        familiaId: 'f1',
        voltarAoSaldo: false,
        registradoPor: 'u1',
      });

      const ativos = await ctx.service.listar({ familiaId: 'f1', status: 'ativo' });
      const encerrados = await ctx.service.listar({ familiaId: 'f1', status: 'encerrado' });
      const daF2 = await ctx.service.listar({ familiaId: 'f2', status: 'ativo' });

      expect(ativos.map((c) => c.nome)).toEqual(['Emergência']);
      expect(encerrados.map((c) => c.nome)).toEqual(['Viagem']);
      expect(daF2.map((c) => c.nome)).toEqual(['Carro']);
    });

    it('detalhe retorna cofrinho com movimentações', async () => {
      const cofrinho = await criar();
      await aportar(cofrinho.id, '100.00');
      await aportar(cofrinho.id, '200.00');

      const result = await ctx.service.detalhe({ id: cofrinho.id, familiaId: 'f1' });

      expect(result.cofrinho.saldoAtual).toBe('300.00');
      expect(result.movimentacoes).toHaveLength(2);
      expect(result.aporteRecorrenteAtivo).toBeNull();
    });

    it('detalhe rejeita cofrinho inexistente', async () => {
      await expect(ctx.service.detalhe({ id: 'inexistente', familiaId: 'f1' })).rejects.toThrow(
        CofrinhoNotFoundError,
      );
    });
  });

  describe('aporte recorrente', () => {
    let recorrente: TransacaoRecorrenteCreatorFake;

    beforeEach(() => {
      recorrente = new TransacaoRecorrenteCreatorFake();
      ctx = montarCofrinhoServiceInMemory({ recorrente });
    });

    const aportarRecorrente = (cofrinhoId: string, extra: Record<string, unknown> = {}) =>
      aportar(cofrinhoId, '200.00', { recorrente: true, frequencia: 'mensal', ...extra });

    it('cria a transação-pai pela porta, com o repositório do tx, + movimentação + saldo', async () => {
      const cofrinho = await criar();

      const result = await aportarRecorrente(cofrinho.id, { descricao: 'Aporte mensal' });

      expect(recorrente.criadas).toHaveLength(1);
      expect(recorrente.criadas[0]).toMatchObject({
        tipo: 'despesa',
        valor: '200.00',
        categoriaId: CATEGORIA_COFRINHO_FAKE,
        cofrinhoId: cofrinho.id,
        frequencia: 'mensal',
      });
      const [pai] = await transacoesDe();
      expect(pai).toMatchObject({ id: result.movimentacao.transacaoId, recorrente: true });
      expect(result.cofrinho.saldoAtual).toBe('200.00');
    });

    it('verifica série ativa só depois de travar a linha (UPDATE do saldo), antes de gravar a série', async () => {
      const cofrinho = await criar();
      ctx.instrumentada.chamadas.length = 0;

      await aportarRecorrente(cofrinho.id);

      expect(ctx.instrumentada.chamadas).toEqual([
        'cofrinhos.incrementarSaldo',
        'cofrinhos.findAporteRecorrenteAtivo',
        'transacoes.create',
        'movimentacoes.create',
      ]);
    });

    it('repassa dataFimRecorrencia', async () => {
      const cofrinho = await criar();

      await aportarRecorrente(cofrinho.id, { dataFimRecorrencia: '2027-12-31' });

      expect(recorrente.criadas[0]?.dataFimRecorrencia).toBe('2027-12-31');
    });

    it('rejeita se já existe aporte recorrente ativo, sem gravar nada', async () => {
      const cofrinho = await criar();
      ctx.cofrinhos.definirAporteRecorrenteAtivo(
        { cofrinhoId: cofrinho.id, familiaId: 'f1' },
        {
          transacaoPaiId: 'tx-existing',
          valor: '100.00',
          frequencia: 'mensal',
          dataFimRecorrencia: null,
        },
      );

      await expect(aportarRecorrente(cofrinho.id)).rejects.toThrow(AporteRecorrenteJaAtivoError);
      expect((await ctx.cofrinhos.findById({ id: cofrinho.id, familiaId: 'f1' }))?.saldoAtual).toBe(
        '0',
      );
    });

    it('sem a porta injetada (produção hoje) falha antes de qualquer escrita', async () => {
      ctx = montarCofrinhoServiceInMemory();
      const cofrinho = await criar();

      await expect(aportarRecorrente(cofrinho.id)).rejects.toThrow(
        AporteRecorrenteIndisponivelError,
      );
      expect(ctx.uow.estatisticas().iniciadas).toBe(0);
    });

    it('cancelarAporteRecorrente cancela a série ativa pela porta', async () => {
      const cofrinho = await criar();
      ctx.cofrinhos.definirAporteRecorrenteAtivo(
        { cofrinhoId: cofrinho.id, familiaId: 'f1' },
        {
          transacaoPaiId: 'tx-recorrente-123',
          valor: '200.00',
          frequencia: 'mensal',
          dataFimRecorrencia: null,
        },
      );

      await ctx.service.cancelarAporteRecorrente({ cofrinhoId: cofrinho.id, familiaId: 'f1' });

      expect(recorrente.canceladas).toEqual([
        { transacaoPaiId: 'tx-recorrente-123', familiaId: 'f1' },
      ]);
    });

    it('cancelarAporteRecorrente sem a porta injetada: erro próprio de cancelamento indisponível', async () => {
      ctx = montarCofrinhoServiceInMemory();
      const cofrinho = await criar();
      ctx.cofrinhos.definirAporteRecorrenteAtivo(
        { cofrinhoId: cofrinho.id, familiaId: 'f1' },
        { transacaoPaiId: 'tx-1', valor: '10.00', frequencia: 'mensal', dataFimRecorrencia: null },
      );

      const erro = await ctx.service
        .cancelarAporteRecorrente({ cofrinhoId: cofrinho.id, familiaId: 'f1' })
        .catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(CancelamentoRecorrenteIndisponivelError);
      expect((erro as Error).message).toMatch(
        /Cancelamento de aporte recorrente indisponível.*tx-1/,
      );
    });

    it('cancelarAporteRecorrente rejeita sem série ativa ou cofrinho inexistente', async () => {
      const cofrinho = await criar();

      await expect(
        ctx.service.cancelarAporteRecorrente({ cofrinhoId: cofrinho.id, familiaId: 'f1' }),
      ).rejects.toThrow(AporteRecorrenteNotFoundError);
      await expect(
        ctx.service.cancelarAporteRecorrente({ cofrinhoId: 'inexistente', familiaId: 'f1' }),
      ).rejects.toThrow(CofrinhoNotFoundError);
    });
  });
});
