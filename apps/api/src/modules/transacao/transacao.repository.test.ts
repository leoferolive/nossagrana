import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({ db: mockDb }));

import { DrizzleTransacaoRepository, InMemoryTransacaoRepository } from './transacao.repository.js';

// ─── helpers ────────────────────────────────────────────────────────────────

const fakeRow = {
  id: 't1',
  familiaId: 'f1',
  tipo: 'despesa',
  valor: '100.00',
  categoriaId: 'c1',
  descricao: null,
  data: '2026-03-10',
  mesReferencia: '2026-03',
  metodoPagamentoId: null,
  usuarioRegistrouId: 'u1',
  recorrente: false,
  frequencia: null,
  dataFimRecorrencia: null,
  parcelado: false,
  numeroParcelas: null,
  parcelaAtual: null,
  valorTotal: null,
  valorParcela: null,
  transacaoPaiId: null,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
};

const baseInput = {
  familiaId: 'f1',
  tipo: 'despesa' as const,
  valor: '100.00',
  categoriaId: 'c1',
  data: '2026-03-10',
  mesReferencia: '2026-03',
  usuarioRegistrouId: 'u1',
};

// ─── InMemory ────────────────────────────────────────────────────────────────

describe('InMemoryTransacaoRepository', () => {
  let repo: InMemoryTransacaoRepository;

  beforeEach(() => {
    repo = new InMemoryTransacaoRepository();
  });

  it('create e list básico', async () => {
    await repo.create(baseInput);
    const list = await repo.list({ familiaId: 'f1' });
    expect(list).toHaveLength(1);
  });

  it('createMany insere múltiplas', async () => {
    await repo.createMany([baseInput, { ...baseInput }]);
    const list = await repo.list({ familiaId: 'f1' });
    expect(list).toHaveLength(2);
  });

  it('createMany com array vazio retorna []', async () => {
    const result = await repo.createMany([]);
    expect(result).toHaveLength(0);
  });

  it('findById retorna transação correta', async () => {
    const created = await repo.create(baseInput);
    const found = await repo.findById({ id: created.id, familiaId: 'f1' });
    expect(found?.id).toBe(created.id);
  });

  it('findById retorna null para id errado', async () => {
    const result = await repo.findById({ id: 'nao-existe', familiaId: 'f1' });
    expect(result).toBeNull();
  });

  it('list filtra por mesReferencia', async () => {
    await repo.create(baseInput);
    await repo.create({ ...baseInput, mesReferencia: '2026-04' });
    const result = await repo.list({ familiaId: 'f1', mesReferencia: '2026-03' });
    expect(result).toHaveLength(1);
  });

  it('list filtra por tipo', async () => {
    await repo.create(baseInput);
    await repo.create({ ...baseInput, tipo: 'receita' });
    const result = await repo.list({ familiaId: 'f1', tipo: 'receita' });
    expect(result).toHaveLength(1);
  });

  it('list filtra por categoriaId', async () => {
    await repo.create(baseInput);
    await repo.create({ ...baseInput, categoriaId: 'c2' });
    const result = await repo.list({ familiaId: 'f1', categoriaId: 'c1' });
    expect(result).toHaveLength(1);
  });

  it('list filtra por usuarioRegistrouId', async () => {
    await repo.create(baseInput);
    await repo.create({ ...baseInput, usuarioRegistrouId: 'u2' });
    const result = await repo.list({ familiaId: 'f1', usuarioRegistrouId: 'u1' });
    expect(result).toHaveLength(1);
  });

  it('list filtra por metodoPagamentoId', async () => {
    await repo.create({ ...baseInput, metodoPagamentoId: 'mp1' });
    await repo.create(baseInput);
    const result = await repo.list({ familiaId: 'f1', metodoPagamentoId: 'mp1' });
    expect(result).toHaveLength(1);
  });

  it('update modifica e retorna', async () => {
    const created = await repo.create(baseInput);
    const updated = await repo.update({
      id: created.id,
      familiaId: 'f1',
      tipo: 'receita',
      valor: '200.00',
      categoriaId: 'c1',
      data: '2026-03-10',
      mesReferencia: '2026-03',
    });
    expect(updated?.tipo).toBe('receita');
    expect(updated?.valor).toBe('200.00');
  });

  it('update retorna null quando nao encontrado', async () => {
    const result = await repo.update({
      id: 'nao-existe',
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '10.00',
      categoriaId: 'c1',
      data: '2026-03-10',
      mesReferencia: '2026-03',
    });
    expect(result).toBeNull();
  });

  it('delete remove e retorna true', async () => {
    const created = await repo.create(baseInput);
    const deleted = await repo.delete({ id: created.id, familiaId: 'f1' });
    expect(deleted).toBe(true);
    expect(await repo.list({ familiaId: 'f1' })).toHaveLength(0);
  });

  it('delete retorna false quando nao encontrado', async () => {
    const result = await repo.delete({ id: 'nao-existe', familiaId: 'f1' });
    expect(result).toBe(false);
  });

  it('deleteManyByPaiId remove filhos', async () => {
    const pai = await repo.create(baseInput);
    await repo.create({ ...baseInput, transacaoPaiId: pai.id, data: '2026-04-10' });
    await repo.create({ ...baseInput, transacaoPaiId: pai.id, data: '2026-05-10' });

    const count = await repo.deleteManyByPaiId({ transacaoPaiId: pai.id, familiaId: 'f1' });
    expect(count).toBe(2);
  });

  it('deleteManyByPaiId com dataMinima filtra por data', async () => {
    const pai = await repo.create(baseInput);
    await repo.create({ ...baseInput, transacaoPaiId: pai.id, data: '2026-04-10' });
    await repo.create({ ...baseInput, transacaoPaiId: pai.id, data: '2026-05-10' });

    const count = await repo.deleteManyByPaiId({
      transacaoPaiId: pai.id,
      familiaId: 'f1',
      dataMinima: '2026-05-01',
    });
    expect(count).toBe(1);
  });

  it('listByPaiId retorna filhos', async () => {
    const pai = await repo.create(baseInput);
    await repo.create({ ...baseInput, transacaoPaiId: pai.id });
    const result = await repo.listByPaiId({ transacaoPaiId: pai.id, familiaId: 'f1' });
    expect(result).toHaveLength(1);
  });

  it('updateManyByPaiId atualiza filhos com dataMinima', async () => {
    const pai = await repo.create(baseInput);
    await repo.create({ ...baseInput, transacaoPaiId: pai.id, data: '2026-04-10' });
    await repo.create({ ...baseInput, transacaoPaiId: pai.id, data: '2026-05-10' });

    const count = await repo.updateManyByPaiId({
      transacaoPaiId: pai.id,
      familiaId: 'f1',
      fields: { valor: '999.00' },
    });
    expect(count).toBe(2);
  });

  it('updateManyByPaiId com dataMinima respeita data', async () => {
    const pai = await repo.create(baseInput);
    await repo.create({ ...baseInput, transacaoPaiId: pai.id, data: '2026-04-10' });
    await repo.create({ ...baseInput, transacaoPaiId: pai.id, data: '2026-06-10' });

    const count = await repo.updateManyByPaiId({
      transacaoPaiId: pai.id,
      familiaId: 'f1',
      dataMinima: '2026-05-01',
      fields: { valor: '999.00' },
    });
    expect(count).toBe(1);
  });
});

// ─── Drizzle (mockDb) ────────────────────────────────────────────────────────

describe('DrizzleTransacaoRepository', () => {
  let repo: DrizzleTransacaoRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DrizzleTransacaoRepository();
  });

  it('create executa insert e retorna', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([fakeRow]),
      }),
    });

    const result = await repo.create(baseInput);
    expect(result.id).toBe('t1');
  });

  it('createMany executa insert e mapeia', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([fakeRow]),
      }),
    });

    const result = await repo.createMany([baseInput]);
    expect(result).toHaveLength(1);
  });

  it('createMany com array vazio retorna []', async () => {
    const result = await repo.createMany([]);
    expect(result).toHaveLength(0);
  });

  it('findById executa select e mapeia', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([fakeRow]),
      }),
    });

    const result = await repo.findById({ id: 't1', familiaId: 'f1' });
    expect(result?.id).toBe('t1');
  });

  it('findById retorna null quando nao encontrado', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await repo.findById({ id: 'nao-existe', familiaId: 'f1' });
    expect(result).toBeNull();
  });

  it('list executa select com filtros', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([fakeRow]),
      }),
    });

    const result = await repo.list({
      familiaId: 'f1',
      mesReferencia: '2026-03',
      tipo: 'despesa',
      categoriaId: 'c1',
      usuarioRegistrouId: 'u1',
      metodoPagamentoId: 'mp1',
    });
    expect(result).toHaveLength(1);
  });

  it('update retorna atualizado', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([fakeRow]),
        }),
      }),
    });

    const result = await repo.update({
      id: 't1',
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '100.00',
      categoriaId: 'c1',
      data: '2026-03-10',
      mesReferencia: '2026-03',
    });
    expect(result).not.toBeNull();
  });

  it('update retorna null quando nao encontrado', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await repo.update({
      id: 'nao-existe',
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '10.00',
      categoriaId: 'c1',
      data: '2026-03-10',
      mesReferencia: '2026-03',
    });
    expect(result).toBeNull();
  });

  it('delete retorna true quando encontrado', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 't1' }]),
      }),
    });

    const result = await repo.delete({ id: 't1', familiaId: 'f1' });
    expect(result).toBe(true);
  });

  it('delete retorna false quando nao encontrado', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await repo.delete({ id: 'nao-existe', familiaId: 'f1' });
    expect(result).toBe(false);
  });

  it('deleteManyByPaiId com dataMinima', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 't2' }, { id: 't3' }]),
      }),
    });

    const count = await repo.deleteManyByPaiId({
      transacaoPaiId: 't1',
      familiaId: 'f1',
      dataMinima: '2026-04-01',
    });
    expect(count).toBe(2);
  });

  it('deleteManyByPaiId sem dataMinima', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 't2' }]),
      }),
    });

    const count = await repo.deleteManyByPaiId({ transacaoPaiId: 't1', familiaId: 'f1' });
    expect(count).toBe(1);
  });

  it('listByPaiId retorna filhos', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([fakeRow]),
      }),
    });

    const result = await repo.listByPaiId({ transacaoPaiId: 't1', familiaId: 'f1' });
    expect(result).toHaveLength(1);
  });

  it('updateManyByPaiId com dataMinima', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 't2' }, { id: 't3' }]),
        }),
      }),
    });

    const count = await repo.updateManyByPaiId({
      transacaoPaiId: 't1',
      familiaId: 'f1',
      dataMinima: '2026-04-01',
      fields: { valor: '200.00' },
    });
    expect(count).toBe(2);
  });

  it('updateManyByPaiId sem dataMinima', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 't2' }]),
        }),
      }),
    });

    const count = await repo.updateManyByPaiId({
      transacaoPaiId: 't1',
      familiaId: 'f1',
      fields: { categoriaId: 'c2' },
    });
    expect(count).toBe(1);
  });
});
