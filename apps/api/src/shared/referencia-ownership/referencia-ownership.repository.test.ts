import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  db: mockDb,
}));

import { InMemoryCategoriaRepository } from '../../modules/categoria/categoria.repository.js';
import { InMemoryCofrinhoRepository } from '../../modules/cofrinho/cofrinho.repository.js';
import { InMemoryMetodoPagamentoRepository } from '../../modules/metodo-pagamento/metodo-pagamento.repository.js';
import {
  DrizzleReferenciaOwnershipRepository,
  InMemoryReferenciaOwnershipRepository,
  ModulosReferenciaOwnershipRepository,
} from './referencia-ownership.repository.js';

describe('InMemoryReferenciaOwnershipRepository', () => {
  it('só encontra registros da família informada', async () => {
    const repository = new InMemoryReferenciaOwnershipRepository();
    repository.addCategoria({ id: 'c1', familiaId: 'f1', tipo: 'receita', ativo: true });
    repository.addMetodoPagamento({ id: 'm1', familiaId: 'f1', ativo: false });
    repository.addCofrinho({ id: 'k1', familiaId: 'f1', ativo: true });

    expect(await repository.findCategoria({ familiaId: 'f1', id: 'c1' })).toEqual({
      id: 'c1',
      tipo: 'receita',
      ativo: true,
    });
    expect(await repository.findMetodoPagamento({ familiaId: 'f1', id: 'm1' })).toEqual({
      id: 'm1',
      ativo: false,
    });
    expect(await repository.findCofrinho({ familiaId: 'f1', id: 'k1' })).toEqual({
      id: 'k1',
      ativo: true,
    });
    expect(await repository.findCategoria({ familiaId: 'f2', id: 'c1' })).toBeNull();
    expect(await repository.findMetodoPagamento({ familiaId: 'f2', id: 'm1' })).toBeNull();
    expect(await repository.findCofrinho({ familiaId: 'f2', id: 'k1' })).toBeNull();
  });
});

describe('DrizzleReferenciaOwnershipRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockSelectReturning(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ limit });
    mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where }) });
    return { where, limit };
  }

  it('busca categoria filtrando por família e id', async () => {
    const { where, limit } = mockSelectReturning([{ id: 'c1', tipo: 'despesa', ativo: true }]);

    const result = await new DrizzleReferenciaOwnershipRepository().findCategoria({
      familiaId: 'f1',
      id: 'c1',
    });

    expect(result).toEqual({ id: 'c1', tipo: 'despesa', ativo: true });
    expect(where).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it('retorna null quando a categoria não pertence à família', async () => {
    mockSelectReturning([]);

    const result = await new DrizzleReferenciaOwnershipRepository().findCategoria({
      familiaId: 'f1',
      id: 'c-outra',
    });

    expect(result).toBeNull();
  });

  it('busca método de pagamento da família', async () => {
    mockSelectReturning([{ id: 'm1', ativo: true }]);

    const repository = new DrizzleReferenciaOwnershipRepository();

    expect(await repository.findMetodoPagamento({ familiaId: 'f1', id: 'm1' })).toEqual({
      id: 'm1',
      ativo: true,
    });
  });

  it('retorna null quando o método de pagamento não pertence à família', async () => {
    mockSelectReturning([]);

    const repository = new DrizzleReferenciaOwnershipRepository();

    expect(await repository.findMetodoPagamento({ familiaId: 'f1', id: 'm2' })).toBeNull();
  });

  it('mapeia status do cofrinho para ativo', async () => {
    const repository = new DrizzleReferenciaOwnershipRepository();

    mockSelectReturning([{ id: 'k1', status: 'ativo' }]);
    expect(await repository.findCofrinho({ familiaId: 'f1', id: 'k1' })).toEqual({
      id: 'k1',
      ativo: true,
    });

    mockSelectReturning([{ id: 'k2', status: 'encerrado' }]);
    expect(await repository.findCofrinho({ familiaId: 'f1', id: 'k2' })).toEqual({
      id: 'k2',
      ativo: false,
    });

    mockSelectReturning([]);
    expect(await repository.findCofrinho({ familiaId: 'f1', id: 'k3' })).toBeNull();
  });
});

describe('ModulosReferenciaOwnershipRepository', () => {
  it('lê referências dos repositórios dos módulos, restritas à família', async () => {
    const categorias = new InMemoryCategoriaRepository();
    const metodosPagamento = new InMemoryMetodoPagamentoRepository();
    const cofrinhos = new InMemoryCofrinhoRepository();
    const repository = new ModulosReferenciaOwnershipRepository({
      categorias,
      metodosPagamento,
      cofrinhos,
    });

    const categoria = await categorias.create({
      familiaId: 'f1',
      nome: 'Mercado',
      tipo: 'despesa',
      criadoPor: 'u1',
    });
    const metodo = await metodosPagamento.create({
      familiaId: 'f1',
      nome: 'Pix',
      tipo: 'pix',
      dataFechamento: null,
      dataVencimento: null,
      usuarioDonoId: 'u1',
    });
    const cofrinho = await cofrinhos.create({ familiaId: 'f1', nome: 'Viagem', criadoPor: 'u1' });
    await cofrinhos.encerrar({ id: cofrinho.id, familiaId: 'f1' });

    expect(await repository.findCategoria({ familiaId: 'f1', id: categoria.id })).toEqual({
      id: categoria.id,
      tipo: 'despesa',
      ativo: true,
    });
    expect(await repository.findMetodoPagamento({ familiaId: 'f1', id: metodo.id })).toEqual({
      id: metodo.id,
      ativo: true,
    });
    expect(await repository.findCofrinho({ familiaId: 'f1', id: cofrinho.id })).toEqual({
      id: cofrinho.id,
      ativo: false,
    });
    expect(await repository.findCategoria({ familiaId: 'f2', id: categoria.id })).toBeNull();
    expect(await repository.findMetodoPagamento({ familiaId: 'f2', id: metodo.id })).toBeNull();
    expect(await repository.findCofrinho({ familiaId: 'f2', id: cofrinho.id })).toBeNull();
  });
});
