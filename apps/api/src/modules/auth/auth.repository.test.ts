import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  db: mockDb,
}));

import { DrizzleAuthRepository, InMemoryAuthRepository } from './auth.repository.js';

describe('InMemoryAuthRepository', () => {
  it('creates and finds user by email', async () => {
    const repository = new InMemoryAuthRepository();

    const created = await repository.createUser({
      nome: 'Leo',
      email: 'leo@example.com',
      senhaHash: 'hash',
    });

    const found = await repository.findByEmail('leo@example.com');
    const missing = await repository.findByEmail('missing@example.com');

    expect(found).toEqual(created);
    expect(missing).toBeNull();
  });
});

describe('DrizzleAuthRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds user by email and returns null when missing', async () => {
    const expectedUser = {
      id: 'u1',
      nome: 'Leo',
      email: 'leo@example.com',
      senhaHash: 'hash',
      dataCriacao: new Date('2026-01-01T00:00:00.000Z'),
    };

    const limitMock = vi.fn().mockResolvedValueOnce([expectedUser]).mockResolvedValueOnce([]);
    const whereMock = vi.fn().mockReturnValue({
      limit: limitMock,
    });
    const fromMock = vi.fn().mockReturnValue({
      where: whereMock,
    });
    mockDb.select.mockReturnValue({
      from: fromMock,
    });

    const repository = new DrizzleAuthRepository();

    await expect(repository.findByEmail('leo@example.com')).resolves.toEqual(expectedUser);
    await expect(repository.findByEmail('missing@example.com')).resolves.toBeNull();
  });

  it('creates user in database', async () => {
    const expectedUser = {
      id: 'u1',
      nome: 'Leo',
      email: 'leo@example.com',
      senhaHash: 'hash',
      dataCriacao: new Date('2026-01-01T00:00:00.000Z'),
    };

    const returningMock = vi.fn().mockResolvedValue([expectedUser]);
    const valuesMock = vi.fn().mockReturnValue({
      returning: returningMock,
    });
    mockDb.insert.mockReturnValue({
      values: valuesMock,
    });

    const repository = new DrizzleAuthRepository();
    const created = await repository.createUser({
      nome: 'Leo',
      email: 'leo@example.com',
      senhaHash: 'hash',
    });

    expect(created).toEqual(expectedUser);
  });

  it('finds user by id and returns null when missing', async () => {
    const expectedUser = {
      id: 'u1',
      nome: 'Leo',
      email: 'leo@example.com',
      senhaHash: 'hash',
      dataCriacao: new Date('2026-01-01T00:00:00.000Z'),
    };

    const limitMock = vi.fn().mockResolvedValueOnce([expectedUser]).mockResolvedValueOnce([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repository = new DrizzleAuthRepository();
    await expect(repository.findById('u1')).resolves.toEqual(expectedUser);
    await expect(repository.findById('u-missing')).resolves.toBeNull();
  });

  it('updateNome updates and returns the user', async () => {
    const updatedUser = {
      id: 'u1',
      nome: 'Leo Atualizado',
      email: 'leo@example.com',
      senhaHash: 'hash',
      dataCriacao: new Date('2026-01-01T00:00:00.000Z'),
    };

    const returningMock = vi.fn().mockResolvedValue([updatedUser]);
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.update.mockReturnValue({ set: setMock });

    const repository = new DrizzleAuthRepository();
    const result = await repository.updateNome('u1', 'Leo Atualizado');
    expect(result).toEqual(updatedUser);
  });

  it('updateSenhaHash calls update without returning', async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.update.mockReturnValue({ set: setMock });

    const repository = new DrizzleAuthRepository();
    await expect(repository.updateSenhaHash('u1', 'newHash')).resolves.toBeUndefined();
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe('InMemoryAuthRepository - findById, updateNome, updateSenhaHash', () => {
  it('findById returns user after creation', async () => {
    const repo = new InMemoryAuthRepository();
    const created = await repo.createUser({
      nome: 'Leo',
      email: 'leo@example.com',
      senhaHash: 'hash',
    });
    const found = await repo.findById(created.id);
    expect(found).toEqual(created);
  });

  it('findById returns null for missing id', async () => {
    const repo = new InMemoryAuthRepository();
    const found = await repo.findById('nao-existe');
    expect(found).toBeNull();
  });

  it('updateNome updates the user name', async () => {
    const repo = new InMemoryAuthRepository();
    const created = await repo.createUser({
      nome: 'Leo',
      email: 'leo@example.com',
      senhaHash: 'hash',
    });
    const updated = await repo.updateNome(created.id, 'Leo Atualizado');
    expect(updated.nome).toBe('Leo Atualizado');
    const found = await repo.findById(created.id);
    expect(found?.nome).toBe('Leo Atualizado');
  });

  it('updateSenhaHash updates the password hash', async () => {
    const repo = new InMemoryAuthRepository();
    const created = await repo.createUser({
      nome: 'Leo',
      email: 'leo@example.com',
      senhaHash: 'oldHash',
    });
    await repo.updateSenhaHash(created.id, 'newHash');
    const found = await repo.findById(created.id);
    expect(found?.senhaHash).toBe('newHash');
  });

  it('updateNome throws when user not found', async () => {
    const repo = new InMemoryAuthRepository();
    await expect(repo.updateNome('nao-existe', 'Leo')).rejects.toThrow('User not found');
  });

  it('updateSenhaHash throws when user not found', async () => {
    const repo = new InMemoryAuthRepository();
    await expect(repo.updateSenhaHash('nao-existe', 'hash')).rejects.toThrow('User not found');
  });
});
