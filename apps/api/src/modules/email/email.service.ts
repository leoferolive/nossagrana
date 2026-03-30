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

let _templates: Record<EmailTemplate, HandlebarsTemplateDelegate<TemplateData>> | null = null;

function getTemplates() {
  if (!_templates) {
    _templates = {
      'password-reset': loadTemplate('password-reset'),
      'email-verification': loadTemplate('email-verification'),
      'magic-link': loadTemplate('magic-link'),
    };
  }
  return _templates;
}

export class EmailService {
  constructor(private readonly sender: EmailSender) {}

  async sendPasswordReset(to: string, userName: string, actionUrl: string): Promise<void> {
    const html = getTemplates()['password-reset']({
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
    const html = getTemplates()['email-verification']({
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
    const html = getTemplates()['magic-link']({
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
