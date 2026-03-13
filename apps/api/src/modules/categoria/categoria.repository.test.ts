import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  db: mockDb,
}));

import { DrizzleCategoriaRepository, InMemoryCategoriaRepository } from './categoria.repository.js';

describe('InMemoryCategoriaRepository', () => {
  it('creates, lists and updates categories by family', async () => {
    const repository = new InMemoryCategoriaRepository();

    const created = await repository.create({
      familiaId: 'f1',
      nome: 'Alimentacao',
      tipo: 'despesa',
      criadoPor: 'u1',
    });

    await repository.create({
      familiaId: 'f2',
      nome: 'Salario',
      tipo: 'receita',
      criadoPor: 'u2',
    });

    const listed = await repository.listByFamiliaId({ familiaId: 'f1' });
    expect(listed).toHaveLength(1);
    expect(listed[0]?.nome).toBe('Alimentacao');

    const updated = await repository.update({
      id: created.id,
      familiaId: 'f1',
      nome: 'Supermercado',
      tipo: 'despesa',
    });

    expect(updated?.nome).toBe('Supermercado');

    const notFound = await repository.update({
      id: 'nao-existe',
      familiaId: 'f1',
      nome: 'X',
      tipo: 'despesa',
    });
    expect(notFound).toBeNull();
  });
});

describe('DrizzleCategoriaRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists active categories filtered by family', async () => {
    const limitResult = [
      {
        id: 'c1',
        familiaId: 'f1',
        nome: 'Mercado',
        tipo: 'despesa',
        ativo: true,
        criadoPor: 'u1',
        criadoEm: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];

    const whereMock = vi.fn().mockResolvedValue(limitResult);
    const fromMock = vi.fn().mockReturnValue({
      where: whereMock,
    });
    mockDb.select.mockReturnValue({
      from: fromMock,
    });

    const repository = new DrizzleCategoriaRepository();
    const result = await repository.listByFamiliaId({ familiaId: 'f1' });

    expect(result).toEqual(limitResult);
  });

  it('creates category and updates existing one', async () => {
    const createdRow = {
      id: 'c1',
      familiaId: 'f1',
      nome: 'Mercado',
      tipo: 'despesa',
      ativo: true,
      criadoPor: 'u1',
      criadoEm: new Date('2026-01-01T00:00:00.000Z'),
    };
    const updatedRow = {
      ...createdRow,
      nome: 'Supermercado',
    };

    const insertReturningMock = vi.fn().mockResolvedValue([createdRow]);
    const insertValuesMock = vi.fn().mockReturnValue({
      returning: insertReturningMock,
    });
    mockDb.insert.mockReturnValue({
      values: insertValuesMock,
    });

    const updateReturningMock = vi.fn().mockResolvedValue([updatedRow]);
    const updateWhereMock = vi.fn().mockReturnValue({
      returning: updateReturningMock,
    });
    const updateSetMock = vi.fn().mockReturnValue({
      where: updateWhereMock,
    });
    mockDb.update.mockReturnValue({
      set: updateSetMock,
    });

    const repository = new DrizzleCategoriaRepository();

    const created = await repository.create({
      familiaId: 'f1',
      nome: 'Mercado',
      tipo: 'despesa',
      criadoPor: 'u1',
    });
    expect(created.nome).toBe('Mercado');

    const updated = await repository.update({
      id: 'c1',
      familiaId: 'f1',
      nome: 'Supermercado',
      tipo: 'despesa',
    });
    expect(updated?.nome).toBe('Supermercado');

    updateReturningMock.mockResolvedValueOnce([]);
    const missing = await repository.update({
      id: 'missing',
      familiaId: 'f1',
      nome: 'X',
      tipo: 'despesa',
    });
    expect(missing).toBeNull();
  });
});
