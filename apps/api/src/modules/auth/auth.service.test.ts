import { describe, expect, it, vi } from 'vitest';

import {
  AuthService,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
  verifyPassword,
} from './auth.service.js';
import type { AuthRepository } from './auth.types.js';
import { SessoesNaoRevogadasError } from './sessoes-nao-revogadas.error.js';
import { SessaoRevogadorFake } from './tests/sessao-revogador-fake.js';

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
    const service = new AuthService(repository, new SessaoRevogadorFake());

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
    const service = new AuthService(repository, new SessaoRevogadorFake());

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
      new SessaoRevogadorFake(),
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

  describe('updateSenha (#119)', () => {
    const verificaSempre = async () => true;
    const hashFixo = async () => 'novo:hash';

    it('revoga todas as sessões do usuário depois de gravar a nova senha', async () => {
      const ordem: string[] = [];
      const repository = buildRepository({
        updateSenhaHash: vi.fn().mockImplementation(async () => void ordem.push('senha')),
      });
      const sessoes = new SessaoRevogadorFake(false, () => ordem.push('revogacao'));
      const service = new AuthService(repository, sessoes, hashFixo, verificaSempre);

      await service.updateSenha('u1', 'atual', 'nova');

      expect(sessoes.usuariosRevogados).toEqual(['u1']);
      // Revogar só depois do update: login com a senha antiga após a revogação criaria sessão nova.
      expect(ordem).toEqual(['senha', 'revogacao']);
    });

    it('não revoga sessões quando a senha atual está incorreta', async () => {
      const sessoes = new SessaoRevogadorFake();
      const service = new AuthService(buildRepository(), sessoes, hashFixo, async () => false);

      await expect(service.updateSenha('u1', 'errada', 'nova')).rejects.toBeInstanceOf(
        InvalidCredentialsError,
      );
      expect(sessoes.usuariosRevogados).toEqual([]);
    });

    it('propaga a falha da revogação sem mascarar como credencial inválida', async () => {
      const sessoes = new SessaoRevogadorFake(true);
      const service = new AuthService(buildRepository(), sessoes, hashFixo, verificaSempre);

      const erro = await service.updateSenha('u1', 'atual', 'nova').catch((e: unknown) => e);

      expect(erro).not.toBeInstanceOf(InvalidCredentialsError);
      // Tipado e com o userId: a rota loga o estado "senha trocada, sessões vivas".
      expect(erro).toBeInstanceOf(SessoesNaoRevogadasError);
      expect((erro as SessoesNaoRevogadasError).userId).toBe('u1');
    });
  });
});
