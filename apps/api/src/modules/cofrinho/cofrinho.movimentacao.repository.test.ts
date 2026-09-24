import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryCofrinhoRepository } from './cofrinho.in-memory-repository.js';
import { InMemoryMovimentacaoCofrinhoRepository } from './cofrinho.movimentacao.repository.js';

describe('InMemoryMovimentacaoCofrinhoRepository', () => {
  let repo: InMemoryCofrinhoRepository;
  let movimentacoes: InMemoryMovimentacaoCofrinhoRepository;

  const f1 = 'familia-1-id';
  const f2 = 'familia-2-id';
  const user1 = 'user-1-id';

  beforeEach(() => {
    repo = new InMemoryCofrinhoRepository();
    movimentacoes = new InMemoryMovimentacaoCofrinhoRepository();
  });

  describe('createMovimentacao', () => {
    it('deve criar movimentacao de aporte com todos os campos', async () => {
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const mov = await movimentacoes.create({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '500.00',
        descricao: 'Primeiro aporte',
        transacaoId: 'transacao-123',
        registradoPor: user1,
        mesReferencia: '2026-03',
      });

      expect(mov.id).toBeDefined();
      expect(mov.cofrinhoId).toBe(cofrinho.id);
      expect(mov.familiaId).toBe(f1);
      expect(mov.tipo).toBe('aporte');
      expect(mov.valor).toBe('500.00');
      expect(mov.descricao).toBe('Primeiro aporte');
      expect(mov.transacaoId).toBe('transacao-123');
      expect(mov.registradoPor).toBe(user1);
      expect(mov.registradoEm).toBeInstanceOf(Date);
      expect(mov.mesReferencia).toBe('2026-03');
    });

    it('deve criar movimentacao de retirada', async () => {
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const mov = await movimentacoes.create({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'retirada',
        valor: '200.00',
        registradoPor: user1,
        mesReferencia: '2026-03',
      });

      expect(mov.tipo).toBe('retirada');
      expect(mov.descricao).toBeNull();
      expect(mov.transacaoId).toBeNull();
    });

    it('deve gerar ids unicos para movimentacoes', async () => {
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const mov1 = await movimentacoes.create({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-03',
      });

      const mov2 = await movimentacoes.create({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '200.00',
        registradoPor: user1,
        mesReferencia: '2026-03',
      });

      expect(mov1.id).not.toBe(mov2.id);
    });
  });

  describe('listMovimentacoes', () => {
    it('deve listar movimentacoes de um cofrinho', async () => {
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      await movimentacoes.create({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      await movimentacoes.create({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '200.00',
        registradoPor: user1,
        mesReferencia: '2026-02',
      });

      const movs = await movimentacoes.listByCofrinho({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
      });

      expect(movs).toHaveLength(2);
    });

    it('deve ordenar por registradoEm decrescente (mais recente primeiro)', async () => {
      vi.useFakeTimers();
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
      const mov1 = await movimentacoes.create({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      vi.setSystemTime(new Date('2026-02-01T10:00:00Z'));
      const mov2 = await movimentacoes.create({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '200.00',
        registradoPor: user1,
        mesReferencia: '2026-02',
      });

      const movs = await movimentacoes.listByCofrinho({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
      });

      expect(movs[0].id).toBe(mov2.id);
      expect(movs[1].id).toBe(mov1.id);
      vi.useRealTimers();
    });

    it('deve filtrar por cofrinhoId', async () => {
      const c1 = await repo.create({ familiaId: f1, nome: 'C1', criadoPor: user1 });
      const c2 = await repo.create({ familiaId: f1, nome: 'C2', criadoPor: user1 });

      await movimentacoes.create({
        cofrinhoId: c1.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      await movimentacoes.create({
        cofrinhoId: c2.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '200.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      const movsC1 = await movimentacoes.listByCofrinho({ cofrinhoId: c1.id, familiaId: f1 });
      const movsC2 = await movimentacoes.listByCofrinho({ cofrinhoId: c2.id, familiaId: f1 });

      expect(movsC1).toHaveLength(1);
      expect(movsC1[0].valor).toBe('100.00');
      expect(movsC2).toHaveLength(1);
      expect(movsC2[0].valor).toBe('200.00');
    });

    it('nao deve retornar movimentacoes de outra familia (multi-tenant)', async () => {
      const cofrinhoF1 = await repo.create({ familiaId: f1, nome: 'C1', criadoPor: user1 });

      await movimentacoes.create({
        cofrinhoId: cofrinhoF1.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      const movs = await movimentacoes.listByCofrinho({
        cofrinhoId: cofrinhoF1.id,
        familiaId: f2,
      });

      expect(movs).toHaveLength(0);
    });

    it('deve retornar lista vazia quando nao ha movimentacoes', async () => {
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const movs = await movimentacoes.listByCofrinho({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
      });

      expect(movs).toEqual([]);
    });
  });

  describe('participante da InMemoryUnitOfWork', () => {
    it('staging isola escritas até publicar', async () => {
      const staging = movimentacoes.abrirStaging();
      await staging.create({
        cofrinhoId: 'c1',
        familiaId: f1,
        tipo: 'aporte',
        valor: '10.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      expect(await movimentacoes.listByCofrinho({ cofrinhoId: 'c1', familiaId: f1 })).toEqual([]);
      movimentacoes.publicar(staging);
      expect(await movimentacoes.listByCofrinho({ cofrinhoId: 'c1', familiaId: f1 })).toHaveLength(
        1,
      );
    });
  });
});
