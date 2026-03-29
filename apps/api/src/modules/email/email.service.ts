import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Handlebars from 'handlebars';

import type { EmailSender, EmailTemplate, TemplateData } from './email.types.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(currentDir, 'templates');

function loadTemplate(name: EmailTemplate): HandlebarsTemplateDelegate<TemplateData> {
  const source = readFileSync(join(templatesDir, `${name}.hbs`), 'utf-8');
  return Handlebars.compile<TemplateData>(source);
}

const templates = {
  'password-reset': loadTemplate('password-reset'),
  'email-verification': loadTemplate('email-verification'),
  'magic-link': loadTemplate('magic-link'),
};

export class EmailService {
  constructor(private readonly sender: EmailSender) {}

  async sendPasswordReset(to: string, userName: string, actionUrl: string): Promise<void> {
    const html = templates['password-reset']({
      userName,
      actionUrl,
      expirationMinutes: 60,
    });
    await this.sender.send({
      to,
      subject: 'Redefinir sua senha — NossaGrana',
      html,
    });
  }

  async sendEmailVerification(to: string, userName: string, actionUrl: string): Promise<void> {
    const html = templates['email-verification']({
      userName,
      actionUrl,
    });
    await this.sender.send({
      to,
      subject: 'Confirme seu e-mail — NossaGrana',
      html,
    });
  }

  async sendMagicLink(to: string, userName: string, actionUrl: string): Promise<void> {
    const html = templates['magic-link']({
      userName,
      actionUrl,
      expirationMinutes: 10,
    });
    await this.sender.send({
      to,
      subject: 'Seu link de acesso — NossaGrana',
      html,
    });
  }
}
