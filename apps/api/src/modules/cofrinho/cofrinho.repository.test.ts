import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InMemoryCofrinhoRepository } from './cofrinho.repository.js';

describe('InMemoryCofrinhoRepository', () => {
  let repo: InMemoryCofrinhoRepository;

  const f1 = 'familia-1-id';
  const f2 = 'familia-2-id';
  const user1 = 'user-1-id';
  const user2 = 'user-2-id';

  beforeEach(() => {
    repo = new InMemoryCofrinhoRepository();
  });

  describe('list', () => {
    it('deve retornar lista vazia quando nao ha cofrinhos', async () => {
      const result = await repo.list({ familiaId: f1, status: 'ativo' });
      expect(result).toEqual([]);
    });

    it('deve filtrar por familiaId', async () => {
      await repo.create({ familiaId: f1, nome: 'Viagem F1', criadoPor: user1 });
      await repo.create({ familiaId: f2, nome: 'Viagem F2', criadoPor: user2 });

      const result = await repo.list({ familiaId: f1, status: 'ativo' });

      expect(result).toHaveLength(1);
      expect(result[0].nome).toBe('Viagem F1');
    });

    it('deve filtrar por status ativo', async () => {
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });
      await repo.create({ familiaId: f1, nome: 'Emergencia', criadoPor: user1 });
      await repo.encerrar({ id: cofrinho.id, familiaId: f1 });

      const ativos = await repo.list({ familiaId: f1, status: 'ativo' });
      const encerrados = await repo.list({ familiaId: f1, status: 'encerrado' });

      expect(ativos).toHaveLength(1);
      expect(ativos[0].nome).toBe('Emergencia');
      expect(encerrados).toHaveLength(1);
      expect(encerrados[0].nome).toBe('Viagem');
    });

    it('nao deve retornar cofrinhos de outra familia (multi-tenant)', async () => {
      await repo.create({ familiaId: f1, nome: 'Cofrinho F1', criadoPor: user1 });
      await repo.create({ familiaId: f2, nome: 'Cofrinho F2', criadoPor: user2 });

      const resultF1 = await repo.list({ familiaId: f1, status: 'ativo' });
      const resultF2 = await repo.list({ familiaId: f2, status: 'ativo' });

      expect(resultF1).toHaveLength(1);
      expect(resultF1[0].nome).toBe('Cofrinho F1');
      expect(resultF2).toHaveLength(1);
      expect(resultF2[0].nome).toBe('Cofrinho F2');
    });
  });

  describe('findById', () => {
    it('deve encontrar cofrinho por id e familiaId', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const found = await repo.findById({ id: created.id, familiaId: f1 });

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.nome).toBe('Viagem');
    });

    it('deve retornar null quando cofrinho nao existe', async () => {
      const found = await repo.findById({ id: 'inexistente', familiaId: f1 });
      expect(found).toBeNull();
    });

    it('deve retornar null quando cofrinho pertence a outra familia (multi-tenant)', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const found = await repo.findById({ id: created.id, familiaId: f2 });

      expect(found).toBeNull();
    });
  });

  describe('create', () => {
    it('deve criar cofrinho com defaults corretos', async () => {
      const created = await repo.create({
        familiaId: f1,
        nome: 'Viagem',
        criadoPor: user1,
      });

      expect(created.id).toBeDefined();
      expect(created.familiaId).toBe(f1);
      expect(created.nome).toBe('Viagem');
      expect(created.emoji).toBeNull();
      expect(created.descricao).toBeNull();
      expect(created.metaValor).toBeNull();
      expect(created.saldoAtual).toBe('0');
      expect(created.status).toBe('ativo');
      expect(created.criadoPor).toBe(user1);
      expect(created.criadoEm).toBeInstanceOf(Date);
      expect(created.encerradoEm).toBeNull();
    });

    it('deve criar cofrinho com todos os campos opcionais', async () => {
      const created = await repo.create({
        familiaId: f1,
        nome: 'Carro novo',
        emoji: '🚗',
        descricao: 'Para comprar o carro',
        metaValor: '50000.00',
        criadoPor: user1,
      });

      expect(created.emoji).toBe('🚗');
      expect(created.descricao).toBe('Para comprar o carro');
      expect(created.metaValor).toBe('50000.00');
    });

    it('deve gerar ids unicos', async () => {
      const c1 = await repo.create({ familiaId: f1, nome: 'C1', criadoPor: user1 });
      const c2 = await repo.create({ familiaId: f1, nome: 'C2', criadoPor: user1 });

      expect(c1.id).not.toBe(c2.id);
    });
  });

  describe('update', () => {
    it('deve atualizar nome do cofrinho', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Antigo', criadoPor: user1 });

      const updated = await repo.update({
        id: created.id,
        familiaId: f1,
        nome: 'Novo',
      });

      expect(updated).not.toBeNull();
      expect(updated!.nome).toBe('Novo');
    });

    it('deve atualizar parcialmente (somente campos fornecidos)', async () => {
      const created = await repo.create({
        familiaId: f1,
        nome: 'Viagem',
        emoji: '✈️',
        descricao: 'Ferias',
        metaValor: '5000.00',
        criadoPor: user1,
      });

      const updated = await repo.update({
        id: created.id,
        familiaId: f1,
        nome: 'Viagem atualizada',
      });

      expect(updated).not.toBeNull();
      expect(updated!.nome).toBe('Viagem atualizada');
      expect(updated!.emoji).toBe('✈️');
      expect(updated!.descricao).toBe('Ferias');
      expect(updated!.metaValor).toBe('5000.00');
    });

    it('deve permitir setar campo opcional como null', async () => {
      const created = await repo.create({
        familiaId: f1,
        nome: 'Viagem',
        emoji: '✈️',
        criadoPor: user1,
      });

      const updated = await repo.update({
        id: created.id,
        familiaId: f1,
        emoji: null,
      });

      expect(updated).not.toBeNull();
      expect(updated!.emoji).toBeNull();
    });

    it('deve retornar null quando cofrinho nao existe', async () => {
      const updated = await repo.update({
        id: 'inexistente',
        familiaId: f1,
        nome: 'Teste',
      });

      expect(updated).toBeNull();
    });

    it('nao deve atualizar cofrinho de outra familia (multi-tenant)', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const updated = await repo.update({
        id: created.id,
        familiaId: f2,
        nome: 'Hackeado',
      });

      expect(updated).toBeNull();

      const original = await repo.findById({ id: created.id, familiaId: f1 });
      expect(original!.nome).toBe('Viagem');
    });

    it('nao deve atualizar cofrinho encerrado', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });
      await repo.encerrar({ id: created.id, familiaId: f1 });

      const updated = await repo.update({
        id: created.id,
        familiaId: f1,
        nome: 'Atualizado',
      });

      expect(updated).toBeNull();
    });
  });

  describe('updateSaldo', () => {
    it('deve atualizar saldo com sucesso', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const updated = await repo.updateSaldo({
        id: created.id,
        familiaId: f1,
        novoSaldo: '1500.50',
      });

      expect(updated).not.toBeNull();
      expect(updated!.saldoAtual).toBe('1500.50');
    });

    it('deve retornar null quando cofrinho nao existe', async () => {
      const updated = await repo.updateSaldo({
        id: 'inexistente',
        familiaId: f1,
        novoSaldo: '100.00',
      });

      expect(updated).toBeNull();
    });

    it('nao deve atualizar saldo de cofrinho de outra familia (multi-tenant)', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const updated = await repo.updateSaldo({
        id: created.id,
        familiaId: f2,
        novoSaldo: '9999.99',
      });

      expect(updated).toBeNull();

      const original = await repo.findById({ id: created.id, familiaId: f1 });
      expect(original!.saldoAtual).toBe('0');
    });

    it('nao deve atualizar saldo de cofrinho encerrado', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });
      await repo.encerrar({ id: created.id, familiaId: f1 });

      const updated = await repo.updateSaldo({
        id: created.id,
        familiaId: f1,
        novoSaldo: '100.00',
      });

      expect(updated).toBeNull();
    });
  });

  describe('encerrar', () => {
    it('deve encerrar cofrinho com sucesso', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const encerrado = await repo.encerrar({ id: created.id, familiaId: f1 });

      expect(encerrado).not.toBeNull();
      expect(encerrado!.status).toBe('encerrado');
      expect(encerrado!.encerradoEm).toBeInstanceOf(Date);
    });

    it('deve retornar null quando ja esta encerrado', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });
      await repo.encerrar({ id: created.id, familiaId: f1 });

      const result = await repo.encerrar({ id: created.id, familiaId: f1 });

      expect(result).toBeNull();
    });

    it('deve retornar null quando cofrinho nao existe', async () => {
      const result = await repo.encerrar({ id: 'inexistente', familiaId: f1 });
      expect(result).toBeNull();
    });

    it('nao deve encerrar cofrinho de outra familia (multi-tenant)', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const result = await repo.encerrar({ id: created.id, familiaId: f2 });

      expect(result).toBeNull();

      const original = await repo.findById({ id: created.id, familiaId: f1 });
      expect(original!.status).toBe('ativo');
    });
  });

  describe('createMovimentacao', () => {
    it('deve criar movimentacao de aporte com todos os campos', async () => {
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const mov = await repo.createMovimentacao({
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

      const mov = await repo.createMovimentacao({
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

      const mov1 = await repo.createMovimentacao({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-03',
      });

      const mov2 = await repo.createMovimentacao({
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

      await repo.createMovimentacao({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      await repo.createMovimentacao({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '200.00',
        registradoPor: user1,
        mesReferencia: '2026-02',
      });

      const movs = await repo.listMovimentacoes({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
      });

      expect(movs).toHaveLength(2);
    });

    it('deve ordenar por registradoEm decrescente (mais recente primeiro)', async () => {
      vi.useFakeTimers();
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      vi.setSystemTime(new Date('2026-01-01T10:00:00Z'));
      const mov1 = await repo.createMovimentacao({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      vi.setSystemTime(new Date('2026-02-01T10:00:00Z'));
      const mov2 = await repo.createMovimentacao({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '200.00',
        registradoPor: user1,
        mesReferencia: '2026-02',
      });

      const movs = await repo.listMovimentacoes({
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

      await repo.createMovimentacao({
        cofrinhoId: c1.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      await repo.createMovimentacao({
        cofrinhoId: c2.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '200.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      const movsC1 = await repo.listMovimentacoes({ cofrinhoId: c1.id, familiaId: f1 });
      const movsC2 = await repo.listMovimentacoes({ cofrinhoId: c2.id, familiaId: f1 });

      expect(movsC1).toHaveLength(1);
      expect(movsC1[0].valor).toBe('100.00');
      expect(movsC2).toHaveLength(1);
      expect(movsC2[0].valor).toBe('200.00');
    });

    it('nao deve retornar movimentacoes de outra familia (multi-tenant)', async () => {
      const cofrinhoF1 = await repo.create({ familiaId: f1, nome: 'C1', criadoPor: user1 });

      await repo.createMovimentacao({
        cofrinhoId: cofrinhoF1.id,
        familiaId: f1,
        tipo: 'aporte',
        valor: '100.00',
        registradoPor: user1,
        mesReferencia: '2026-01',
      });

      const movs = await repo.listMovimentacoes({
        cofrinhoId: cofrinhoF1.id,
        familiaId: f2,
      });

      expect(movs).toHaveLength(0);
    });

    it('deve retornar lista vazia quando nao ha movimentacoes', async () => {
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const movs = await repo.listMovimentacoes({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
      });

      expect(movs).toEqual([]);
    });
  });

  describe('findAporteRecorrenteAtivo', () => {
    it('deve retornar null (InMemory sempre retorna null)', async () => {
      const cofrinho = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      const result = await repo.findAporteRecorrenteAtivo({
        cofrinhoId: cofrinho.id,
        familiaId: f1,
      });

      expect(result).toBeNull();
    });
  });
});
