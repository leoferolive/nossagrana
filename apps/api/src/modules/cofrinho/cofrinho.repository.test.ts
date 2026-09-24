import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryCofrinhoRepository } from './cofrinho.in-memory-repository.js';

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

  describe('incrementarSaldo', () => {
    it('soma em centavos exatos e devolve o cofrinho atualizado', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      await repo.incrementarSaldo({ id: created.id, familiaId: f1, valor: '0.10' });
      const updated = await repo.incrementarSaldo({ id: created.id, familiaId: f1, valor: '0.20' });

      expect(updated?.saldoAtual).toBe('0.30');
    });

    it.each([
      ['inexistente', 'inexistente', f1],
      ['de outra familia (multi-tenant)', 'criado', f2],
    ])('devolve null para cofrinho %s sem alterar saldo', async (_caso, id, familiaId) => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });
      const alvo = id === 'criado' ? created.id : id;

      expect(await repo.incrementarSaldo({ id: alvo, familiaId, valor: '10.00' })).toBeNull();
      expect((await repo.findById({ id: created.id, familiaId: f1 }))?.saldoAtual).toBe('0');
    });

    it('devolve null para cofrinho encerrado', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });
      await repo.encerrar({ id: created.id, familiaId: f1 });

      expect(await repo.incrementarSaldo({ id: created.id, familiaId: f1, valor: '1' })).toBeNull();
    });
  });

  describe('decrementarSaldo', () => {
    async function comSaldo(valor: string) {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });
      await repo.incrementarSaldo({ id: created.id, familiaId: f1, valor });
      return created.id;
    }

    it('retira o saldo exato e chega a zero', async () => {
      const id = await comSaldo('100.00');

      const updated = await repo.decrementarSaldo({ id, familiaId: f1, valor: '100.00' });

      expect(updated?.saldoAtual).toBe('0.00');
    });

    it('recusa (null) retirada acima do saldo e mantém o saldo', async () => {
      const id = await comSaldo('100.00');

      expect(await repo.decrementarSaldo({ id, familiaId: f1, valor: '100.01' })).toBeNull();
      expect((await repo.findById({ id, familiaId: f1 }))?.saldoAtual).toBe('100.00');
    });

    it('recusa (null) cofrinho de outra familia e encerrado', async () => {
      const id = await comSaldo('50.00');

      expect(await repo.decrementarSaldo({ id, familiaId: f2, valor: '1.00' })).toBeNull();
      await repo.encerrar({ id, familiaId: f1 });
      expect(await repo.decrementarSaldo({ id, familiaId: f1, valor: '1.00' })).toBeNull();
    });
  });

  describe('bloquearParaAtualizacao', () => {
    it('devolve o cofrinho só na própria familia', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });

      expect(await repo.bloquearParaAtualizacao({ id: created.id, familiaId: f1 })).toEqual(
        created,
      );
      expect(await repo.bloquearParaAtualizacao({ id: created.id, familiaId: f2 })).toBeNull();
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
  describe('participante da InMemoryUnitOfWork', () => {
    it('staging não vaza para a base antes de publicar (substitui, não muta)', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });
      const staging = repo.abrirStaging();

      await staging.incrementarSaldo({ id: created.id, familiaId: f1, valor: '10.00' });

      expect((await repo.findById({ id: created.id, familiaId: f1 }))?.saldoAtual).toBe('0');
      repo.publicar(staging);
      expect((await repo.findById({ id: created.id, familiaId: f1 }))?.saldoAtual).toBe('10.00');
    });

    it('aporte recorrente ativo definido no teste é visto no staging', async () => {
      const created = await repo.create({ familiaId: f1, nome: 'Viagem', criadoPor: user1 });
      const aporte = {
        transacaoPaiId: 'tx-1',
        valor: '10.00',
        frequencia: 'mensal' as const,
        dataFimRecorrencia: null,
      };
      repo.definirAporteRecorrenteAtivo({ cofrinhoId: created.id, familiaId: f1 }, aporte);

      const busca = { cofrinhoId: created.id, familiaId: f1 };
      expect(await repo.abrirStaging().findAporteRecorrenteAtivo(busca)).toEqual(aporte);
      expect(await repo.findAporteRecorrenteAtivo({ ...busca, familiaId: f2 })).toBeNull();
    });
  });
});
