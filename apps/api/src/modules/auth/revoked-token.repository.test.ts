import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hashToken, InMemoryRevokedTokenRepository } from './revoked-token.repository.js';

describe('InMemoryRevokedTokenRepository', () => {
  let repo: InMemoryRevokedTokenRepository;

  beforeEach(() => {
    repo = new InMemoryRevokedTokenRepository();
  });

  describe('revokeToken', () => {
    it('deve revogar um token com sucesso', async () => {
      const tokenHash = hashToken('my-refresh-token');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await repo.revokeToken(tokenHash, expiresAt, 'test-user-id');

      expect(await repo.isRevoked(tokenHash)).toBe(true);
    });

    it('nao deve duplicar se o mesmo token for revogado novamente', async () => {
      const tokenHash = hashToken('my-refresh-token');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await repo.revokeToken(tokenHash, expiresAt, 'test-user-id');
      await repo.revokeToken(tokenHash, expiresAt, 'test-user-id');

      expect(await repo.isRevoked(tokenHash)).toBe(true);
    });
  });

  describe('isRevoked', () => {
    it('deve retornar false para token nao revogado', async () => {
      const tokenHash = hashToken('unknown-token');
      expect(await repo.isRevoked(tokenHash)).toBe(false);
    });

    it('deve retornar true para token revogado', async () => {
      const tokenHash = hashToken('revoked-token');
      const expiresAt = new Date(Date.now() + 60 * 1000);
      await repo.revokeToken(tokenHash, expiresAt, 'test-user-id');

      expect(await repo.isRevoked(tokenHash)).toBe(true);
    });
  });

  describe('cleanupExpired', () => {
    it('deve remover tokens expirados', async () => {
      const expiredHash = hashToken('expired-token');
      const validHash = hashToken('valid-token');

      await repo.revokeToken(expiredHash, new Date(Date.now() - 1000), 'test-user-id');
      await repo.revokeToken(validHash, new Date(Date.now() + 60 * 60 * 1000), 'test-user-id');

      const removed = await repo.cleanupExpired();

      expect(removed).toBe(1);
      expect(await repo.isRevoked(expiredHash)).toBe(false);
      expect(await repo.isRevoked(validHash)).toBe(true);
    });

    it('deve retornar 0 quando nao ha tokens expirados', async () => {
      const validHash = hashToken('valid-token');
      await repo.revokeToken(validHash, new Date(Date.now() + 60 * 60 * 1000), 'test-user-id');

      const removed = await repo.cleanupExpired();
      expect(removed).toBe(0);
    });

    it('deve remover multiplos tokens expirados', async () => {
      const hash1 = hashToken('expired-1');
      const hash2 = hashToken('expired-2');
      const hash3 = hashToken('valid-1');

      await repo.revokeToken(hash1, new Date(Date.now() - 2000), 'test-user-id');
      await repo.revokeToken(hash2, new Date(Date.now() - 1000), 'test-user-id');
      await repo.revokeToken(hash3, new Date(Date.now() + 60 * 60 * 1000), 'test-user-id');

      const removed = await repo.cleanupExpired();

      expect(removed).toBe(2);
      expect(await repo.isRevoked(hash1)).toBe(false);
      expect(await repo.isRevoked(hash2)).toBe(false);
      expect(await repo.isRevoked(hash3)).toBe(true);
    });
  });

  describe('revokeAllByUserId', () => {
    it('registra o instante da revogação global só para o usuário revogado', async () => {
      const antes = Date.now();
      await repo.revokeAllByUserId('compromised-user');

      const revogadoEm = await repo.findRevokedAllAt('compromised-user');
      expect(revogadoEm?.getTime()).toBeGreaterThanOrEqual(antes);
      expect(await repo.findRevokedAllAt('safe-user')).toBeNull();
    });

    it('uma nova revogação avança o instante registrado (troca de senha após reset)', async () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date('2026-09-30T10:00:00Z'));
        await repo.revokeAllByUserId('user-1');
        vi.setSystemTime(new Date('2026-09-30T11:00:00Z'));
        await repo.revokeAllByUserId('user-1');

        expect((await repo.findRevokedAllAt('user-1'))?.toISOString()).toBe(
          '2026-09-30T11:00:00.000Z',
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('findRevokedAllAt', () => {
    it('retorna null para usuario sem revogacao global', async () => {
      expect(await repo.findRevokedAllAt('safe-user')).toBeNull();
    });
  });

  describe('hashToken', () => {
    it('deve gerar hash SHA-256 determinisfico', () => {
      const token = 'my-refresh-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it('deve gerar hashes diferentes para tokens diferentes', () => {
      const hash1 = hashToken('token-a');
      const hash2 = hashToken('token-b');

      expect(hash1).not.toBe(hash2);
    });
  });
});
