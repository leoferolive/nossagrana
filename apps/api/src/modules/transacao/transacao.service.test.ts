import { describe, expect, it } from 'vitest';

import { InMemoryTransacaoRepository } from './transacao.repository.js';
import {
  TransacaoNotFoundError,
  TransacaoService,
} from './transacao.service.js';

const buildService = () => {
  const repository = new InMemoryTransacaoRepository();
  const service = new TransacaoService(repository);
  return { repository, service };
};

describe('TransacaoService', () => {
  describe('UC06 — Registrar transação simples', () => {
    it('cria transação simples com mês de referência calculado (pix)', async () => {
      const { service } = buildService();

      const t = await service.registrar({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '150.00',
        categoriaId: 'cat1',
        descricao: 'Mercado',
        data: '2026-03-10',
        metodoPagamentoId: null,
        metodoPagamentoTipo: null,
        dataFechamento: null,
        usuarioRegistrouId: 'u1',
      });

      expect(t.mesReferencia).toBe('2026-03');
      expect(t.valor).toBe('150.00');
      expect(t.parcelado).toBe(false);
      expect(t.recorrente).toBe(false);
    });

    it('calcula mês de referência de crédito após fechamento', async () => {
      const { service } = buildService();

      const t = await service.registrar({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '200.00',
        categoriaId: 'cat1',
        data: '2026-03-20',
        metodoPagamentoId: 'mp1',
        metodoPagamentoTipo: 'credito',
        dataFechamento: 15,
        usuarioRegistrouId: 'u1',
      });

      expect(t.mesReferencia).toBe('2026-04');
    });
  });

  describe('UC07/UC29 — Registrar transação parcelada', () => {
    it('gera N parcelas com valor_parcela correto', async () => {
      const { repository, service } = buildService();

      const pai = await service.registrar({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '300.00',
        categoriaId: 'cat1',
        data: '2026-03-10',
        metodoPagamentoId: 'mp1',
        metodoPagamentoTipo: 'credito',
        dataFechamento: 15,
        usuarioRegistrouId: 'u1',
        parcelado: true,
        numeroParcelas: 3,
      });

      expect(pai.parcelado).toBe(true);
      expect(pai.numeroParcelas).toBe(3);
      expect(pai.parcelaAtual).toBe(1);

      const todas = await repository.listByPaiId({ transacaoPaiId: pai.id, familiaId: 'f1' });
      expect(todas).toHaveLength(2); // parcelas 2 e 3 (a 1ª é o pai)

      const parcelaValor = Number(pai.valorParcela);
      expect(parcelaValor).toBeCloseTo(100, 1);

      // Meses de referência das parcelas (crédito dia 10, fechamento 15)
      // Parcela 1: março (dia 10 <= 15)
      expect(pai.mesReferencia).toBe('2026-03');
      // Parcela 2: abril
      expect(todas[0]?.mesReferencia).toBe('2026-04');
      // Parcela 3: maio
      expect(todas[1]?.mesReferencia).toBe('2026-05');
    });
  });

  describe('UC08/UC30 — Registrar transação recorrente', () => {
    it('gera lançamentos mensais até a data fim', async () => {
      const { repository, service } = buildService();

      const pai = await service.registrar({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '50.00',
        categoriaId: 'cat1',
        data: '2026-01-10',
        metodoPagamentoId: null,
        metodoPagamentoTipo: null,
        dataFechamento: null,
        usuarioRegistrouId: 'u1',
        recorrente: true,
        frequencia: 'mensal',
        dataFimRecorrencia: '2026-03-10',
      });

      expect(pai.recorrente).toBe(true);

      const recorrencias = await repository.listByPaiId({
        transacaoPaiId: pai.id,
        familiaId: 'f1',
      });
      // jan (pai), fev, mar → 2 recorrências adicionais
      expect(recorrencias).toHaveLength(2);
      expect(recorrencias[0]?.mesReferencia).toBe('2026-02');
      expect(recorrencias[1]?.mesReferencia).toBe('2026-03');
    });

    it('gera lançamentos quinzenais', async () => {
      const { repository, service } = buildService();

      const pai = await service.registrar({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '25.00',
        categoriaId: 'cat1',
        data: '2026-01-01',
        metodoPagamentoId: null,
        metodoPagamentoTipo: null,
        dataFechamento: null,
        usuarioRegistrouId: 'u1',
        recorrente: true,
        frequencia: 'quinzenal',
        dataFimRecorrencia: '2026-01-31',
      });

      const recorrencias = await repository.listByPaiId({
        transacaoPaiId: pai.id,
        familiaId: 'f1',
      });
      // Jan 1 (pai), Jan 16, Jan 31 → 2 adicionais
      expect(recorrencias).toHaveLength(2);
    });
  });

  describe('UC13 — Listar transações com filtros', () => {
    it('lista por família e mês de referência', async () => {
      const { service } = buildService();

      await service.registrar({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '100.00',
        categoriaId: 'cat1',
        data: '2026-03-10',
        metodoPagamentoId: null,
        metodoPagamentoTipo: null,
        dataFechamento: null,
        usuarioRegistrouId: 'u1',
      });

      await service.registrar({
        familiaId: 'f1',
        tipo: 'receita',
        valor: '5000.00',
        categoriaId: 'cat2',
        data: '2026-02-01',
        metodoPagamentoId: null,
        metodoPagamentoTipo: null,
        dataFechamento: null,
        usuarioRegistrouId: 'u1',
      });

      const marco = await service.listar({ familiaId: 'f1', mesReferencia: '2026-03' });
      expect(marco).toHaveLength(1);
      expect(marco[0]?.valor).toBe('100.00');
    });

    it('não retorna transações de outra família', async () => {
      const { service } = buildService();

      await service.registrar({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '100.00',
        categoriaId: 'cat1',
        data: '2026-03-10',
        metodoPagamentoId: null,
        metodoPagamentoTipo: null,
        dataFechamento: null,
        usuarioRegistrouId: 'u1',
      });

      const result = await service.listar({ familiaId: 'f2', mesReferencia: '2026-03' });
      expect(result).toHaveLength(0);
    });
  });

  describe('UC10 — Excluir transação', () => {
    it('exclui transação e retorna sucesso', async () => {
      const { service } = buildService();

      const t = await service.registrar({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '100.00',
        categoriaId: 'cat1',
        data: '2026-03-10',
        metodoPagamentoId: null,
        metodoPagamentoTipo: null,
        dataFechamento: null,
        usuarioRegistrouId: 'u1',
      });

      await service.excluir({ id: t.id, familiaId: 'f1' });

      await expect(
        service.detalhe({ id: t.id, familiaId: 'f1' }),
      ).rejects.toThrow(TransacaoNotFoundError);
    });

    it('lança TransacaoNotFoundError ao excluir inexistente', async () => {
      const { service } = buildService();
      await expect(
        service.excluir({ id: 'nao-existe', familiaId: 'f1' }),
      ).rejects.toThrow(TransacaoNotFoundError);
    });
  });

  describe('UC09 — Editar transação', () => {
    it('edita transação simples', async () => {
      const { service } = buildService();

      const t = await service.registrar({
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '100.00',
        categoriaId: 'cat1',
        data: '2026-03-10',
        metodoPagamentoId: null,
        metodoPagamentoTipo: null,
        dataFechamento: null,
        usuarioRegistrouId: 'u1',
      });

      const updated = await service.editar({
        id: t.id,
        familiaId: 'f1',
        tipo: 'despesa',
        valor: '150.00',
        categoriaId: 'cat1',
        data: '2026-03-10',
        metodoPagamentoId: null,
        metodoPagamentoTipo: null,
        dataFechamento: null,
      });

      expect(updated.valor).toBe('150.00');
    });
  });
});
