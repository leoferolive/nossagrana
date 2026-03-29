import { randomUUID } from 'node:crypto';

import type { EmailService } from '../email/email.service.js';

import type { AuthRepository } from './auth.types.js';
import type { PasswordResetRepository } from './password-reset.types.js';
import { hashToken } from './revoked-token.repository.js';

export class PasswordResetService {
  constructor(
    private readonly authRepo: AuthRepository,
    private readonly resetRepo: PasswordResetRepository,
    private readonly emailService: EmailService,
    private readonly frontendUrl: string,
    private readonly hashFn: (password: string) => Promise<string>,
  ) {}

  async requestReset(email: string): Promise<void> {
    const user = await this.authRepo.findByEmail(email);
    if (!user) return;

    await this.resetRepo.deleteUnusedByUserId(user.id);

    const token = randomUUID();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.resetRepo.createToken(user.id, tokenHash, expiresAt);

    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;
    await this.emailService.sendPasswordReset(user.email, user.nome, resetUrl);
  }

  async resetPassword(token: string, novaSenha: string): Promise<void> {
    const tokenHash = hashToken(token);
    const resetToken = await this.resetRepo.findByTokenHash(tokenHash);

    if (!resetToken) {
      throw new InvalidResetTokenError('Token inválido ou já utilizado');
    }

    if (resetToken.used) {
      throw new InvalidResetTokenError('Token já utilizado');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new InvalidResetTokenError('Token expirado');
    }

    await this.resetRepo.markUsed(tokenHash);

    const novoHash = await this.hashFn(novaSenha);
    await this.authRepo.updateSenhaHash(resetToken.userId, novoHash);
  }
}

export class InvalidResetTokenError extends Error {
  constructor(message: string) {
    super(message);
  }
}
