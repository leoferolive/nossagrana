import { describe, expect, it, beforeEach } from 'vitest';

import { InMemoryEmailSender } from './email.in-memory-sender.js';
import { EmailService } from './email.service.js';

describe('EmailService', () => {
  let sender: InMemoryEmailSender;
  let emailService: EmailService;

  beforeEach(() => {
    sender = new InMemoryEmailSender();
    emailService = new EmailService(sender);
  });

  it('sends password reset email with correct subject and content', async () => {
    await emailService.sendPasswordReset(
      'user@test.com',
      'João',
      'https://app.com/reset?token=abc',
    );

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toBe('user@test.com');
    expect(sender.sent[0].subject).toBe('Redefinir sua senha — NossaGrana');
    expect(sender.sent[0].html).toContain('João');
    expect(sender.sent[0].html).toContain('https://app.com/reset?token=abc');
    expect(sender.sent[0].html).toContain('60');
  });

  it('sends email verification with correct subject and content', async () => {
    await emailService.sendEmailVerification(
      'maria@test.com',
      'Maria',
      'https://app.com/verify?token=xyz',
    );

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toBe('maria@test.com');
    expect(sender.sent[0].subject).toBe('Confirme seu e-mail — NossaGrana');
    expect(sender.sent[0].html).toContain('Maria');
    expect(sender.sent[0].html).toContain('https://app.com/verify?token=xyz');
  });

  it('sends magic link with correct subject and content', async () => {
    await emailService.sendMagicLink('pedro@test.com', 'Pedro', 'https://app.com/magic?token=123');

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toBe('pedro@test.com');
    expect(sender.sent[0].subject).toBe('Seu link de acesso — NossaGrana');
    expect(sender.sent[0].html).toContain('Pedro');
    expect(sender.sent[0].html).toContain('https://app.com/magic?token=123');
    expect(sender.sent[0].html).toContain('10');
  });
});
