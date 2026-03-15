import { describe, expect, it, vi } from 'vitest';

import {
  AuthService,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  verifyPassword,
} from './auth.service.js';
import type { AuthRepository } from './auth.types.js';

const defaultUser = {
  id: 'u1',
  nome: 'Leo',
  email: 'leo@example.com',
  senhaHash: 'hash',
  dataCriacao: new Date('2026-01-01T00:00:00.000Z'),
};

const buildRepository = (overrides?: Partial<AuthRepository>): AuthRepository => ({
  findByEmail: vi.fn().mockResolvedValue(null),
  findById: vi.fn().mockResolvedValue(defaultUser),
  createUser: vi.fn().mockResolvedValue(defaultUser),
  updateNome: vi.fn().mockResolvedValue(defaultUser),
  updateSenhaHash: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe('AuthService', () => {
  it('throws when registering duplicated email', async () => {
    const repository = buildRepository({
      findByEmail: vi.fn().mockResolvedValue({
        id: 'u1',
        nome: 'Leo',
        email: 'leo@example.com',
        senhaHash: 'hash',
        dataCriacao: new Date(),
      }),
    });
    const service = new AuthService(repository);

    await expect(
      service.register({
        nome: 'Leo',
        email: 'leo@example.com',
        senha: 'password123',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('maps unique constraint violation to EmailAlreadyExistsError', async () => {
    const repository = buildRepository({
      findByEmail: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockRejectedValue({ code: '23505' }),
    });
    const service = new AuthService(repository);

    await expect(
      service.register({
        nome: 'Leo',
        email: 'leo@example.com',
        senha: 'password123',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('throws when login password does not match', async () => {
    const repository = buildRepository({
      findByEmail: vi.fn().mockResolvedValue({
        id: 'u1',
        nome: 'Leo',
        email: 'leo@example.com',
        senhaHash: 'salt:hash',
        dataCriacao: new Date(),
      }),
    });
    const service = new AuthService(
      repository,
      async () => 'salt:hash',
      async () => false,
    );

    await expect(
      service.login({
        email: 'leo@example.com',
        senha: 'wrong-pass',
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('returns false when verifying malformed password hash', async () => {
    await expect(verifyPassword('password123', 'invalid')).resolves.toBe(false);
  });
});
