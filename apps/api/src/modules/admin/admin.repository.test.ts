import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  db: mockDb,
}));

import { DrizzleAdminRepository, InMemoryAdminRepository } from './admin.repository.js';

describe('InMemoryAdminRepository', () => {
  let repo: InMemoryAdminRepository;

  beforeEach(() => {
    repo = new InMemoryAdminRepository();
  });

  it('findFamiliaDeleted returns null when not seeded', async () => {
    const result = await repo.findFamiliaDeleted('familia-x');
    expect(result).toBeNull();
  });

  it('findFamiliaDeleted returns deleted familia when seeded', async () => {
    const familia = { id: 'f1', nome: 'Familia Oliveira', deletedAt: new Date('2026-01-01') };
    repo.seedDeletedFamilia(familia);
    const result = await repo.findFamiliaDeleted('f1');
    expect(result).toEqual(familia);
  });

  it('recuperarFamilia returns true and removes from map when exists', async () => {
    const familia = { id: 'f1', nome: 'Familia Oliveira', deletedAt: new Date('2026-01-01') };
    repo.seedDeletedFamilia(familia);
    const result = await repo.recuperarFamilia('f1');
    expect(result).toBe(true);
    expect(await repo.findFamiliaDeleted('f1')).toBeNull();
  });

  it('recuperarFamilia returns false when not exists', async () => {
    const result = await repo.recuperarFamilia('nao-existe');
    expect(result).toBe(false);
  });

  it('findUserById returns null when not seeded', async () => {
    const result = await repo.findUserById('u-missing');
    expect(result).toBeNull();
  });

  it('findUserById returns user when seeded', async () => {
    const user = { id: 'u1', email: 'leo@example.com', nome: 'Leo' };
    repo.seedUser(user);
    const result = await repo.findUserById('u1');
    expect(result).toEqual(user);
  });
});

describe('DrizzleAdminRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('findFamiliaDeleted returns familia when deletedAt is set', async () => {
    const deletedAt = new Date('2026-01-01');
    const row = { id: 'f1', nome: 'Familia Oliveira', deletedAt };

    const limitMock = vi.fn().mockResolvedValue([row]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleAdminRepository();
    const result = await repo.findFamiliaDeleted('f1');
    expect(result).toEqual({ id: 'f1', nome: 'Familia Oliveira', deletedAt });
  });

  it('findFamiliaDeleted returns null when row not found', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleAdminRepository();
    const result = await repo.findFamiliaDeleted('f-missing');
    expect(result).toBeNull();
  });

  it('findFamiliaDeleted returns null when deletedAt is null', async () => {
    const row = { id: 'f1', nome: 'Familia Oliveira', deletedAt: null };

    const limitMock = vi.fn().mockResolvedValue([row]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleAdminRepository();
    const result = await repo.findFamiliaDeleted('f1');
    expect(result).toBeNull();
  });

  it('recuperarFamilia returns true when result has rows', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 'f1' }]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.update.mockReturnValue({ set: setMock });

    const repo = new DrizzleAdminRepository();
    const result = await repo.recuperarFamilia('f1');
    expect(result).toBe(true);
  });

  it('recuperarFamilia returns false when result is empty', async () => {
    const returningMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.update.mockReturnValue({ set: setMock });

    const repo = new DrizzleAdminRepository();
    const result = await repo.recuperarFamilia('f-missing');
    expect(result).toBe(false);
  });

  it('findUserById returns user when found', async () => {
    const user = { id: 'u1', email: 'leo@example.com', nome: 'Leo' };

    const limitMock = vi.fn().mockResolvedValue([user]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleAdminRepository();
    const result = await repo.findUserById('u1');
    expect(result).toEqual(user);
  });

  it('findUserById returns null when not found', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleAdminRepository();
    const result = await repo.findUserById('u-missing');
    expect(result).toBeNull();
  });
});
