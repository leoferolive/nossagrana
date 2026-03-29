import { describe, expect, it, beforeEach } from 'vitest';

import { InMemoryEmailSender } from '../email/email.in-memory-sender.js';
import { EmailService } from '../email/email.service.js';

import { InMemoryAuthRepository } from './auth.repository.js';
import { InMemoryPasswordResetRepository } from './password-reset.repository.js';
import { InvalidResetTokenError, PasswordResetService } from './password-reset.service.js';
import { hashToken } from './revoked-token.repository.js';

const mockHash = async (password: string): Promise<string> => `hashed:${password}`;

describe('PasswordResetService', () => {
  let authRepo: InMemoryAuthRepository;
  let resetRepo: InMemoryPasswordResetRepository;
  let emailSender: InMemoryEmailSender;
  let emailService: EmailService;
  let service: PasswordResetService;

  beforeEach(() => {
    authRepo = new InMemoryAuthRepository();
    resetRepo = new InMemoryPasswordResetRepository();
    emailSender = new InMemoryEmailSender();
    emailService = new EmailService(emailSender);
    service = new PasswordResetService(
      authRepo,
      resetRepo,
      emailService,
      'http://localhost:5173',
      mockHash,
    );
  });

  describe('requestReset', () => {
    it('sends email when user exists', async () => {
      await authRepo.createUser({
        nome: 'João',
        email: 'joao@test.com',
        senhaHash: 'hash123',
      });

      await service.requestReset('joao@test.com');

      expect(emailSender.sent).toHaveLength(1);
      expect(emailSender.sent[0].to).toBe('joao@test.com');
      expect(emailSender.sent[0].html).toContain('João');
      expect(emailSender.sent[0].html).toContain('reset-password?token=');
    });

    it('does not send email when user does not exist', async () => {
      await service.requestReset('naoexiste@test.com');

      expect(emailSender.sent).toHaveLength(0);
    });

    it('does not throw when user does not exist', async () => {
      await expect(service.requestReset('naoexiste@test.com')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('updates password with valid token', async () => {
      const user = await authRepo.createUser({
        nome: 'Maria',
        email: 'maria@test.com',
        senhaHash: 'oldHash',
      });

      await service.requestReset('maria@test.com');

      const tokenUrl = emailSender.sent[0].html.match(/reset-password\?token=([a-f0-9-]+)/);
      const token = tokenUrl![1];

      await service.resetPassword(token, 'novaSenha123');

      const updatedUser = await authRepo.findById(user.id);
      expect(updatedUser!.senhaHash).toBe('hashed:novaSenha123');
    });

    it('throws for invalid token', async () => {
      await expect(service.resetPassword('invalid-token', 'nova')).rejects.toThrow(
        InvalidResetTokenError,
      );
    });

    it('throws for expired token', async () => {
      const user = await authRepo.createUser({
        nome: 'Pedro',
        email: 'pedro@test.com',
        senhaHash: 'hash',
      });

      const token = 'expired-token';
      const tokenHash = hashToken(token);
      const expiredDate = new Date(Date.now() - 1000);
      await resetRepo.createToken(user.id, tokenHash, expiredDate);

      await expect(service.resetPassword(token, 'nova')).rejects.toThrow(InvalidResetTokenError);
    });

    it('throws for already used token', async () => {
      const user = await authRepo.createUser({
        nome: 'Ana',
        email: 'ana@test.com',
        senhaHash: 'hash',
      });

      const token = 'used-token';
      const tokenHash = hashToken(token);
      const futureDate = new Date(Date.now() + 3600000);
      await resetRepo.createToken(user.id, tokenHash, futureDate);
      await resetRepo.markUsed(tokenHash);

      await expect(service.resetPassword(token, 'nova')).rejects.toThrow(InvalidResetTokenError);
    });
  });
});
