import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
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
});
