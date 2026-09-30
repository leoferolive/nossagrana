import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SmtpEmailSender } from './email.smtp-sender.js';

interface TransportOptions {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
}

interface SentMail {
  from: string;
  to: string;
  subject: string;
  html: string;
}

/** Fake do Transporter do nodemailer: registra opções de criação e e-mails enviados. */
class FakeSmtpTransport {
  static created: TransportOptions[] = [];
  static instances: FakeSmtpTransport[] = [];
  static failWith: Error | null = null;
  readonly sent: SentMail[] = [];

  constructor(options: TransportOptions) {
    FakeSmtpTransport.created.push(options);
    FakeSmtpTransport.instances.push(this);
  }

  async sendMail(mail: SentMail): Promise<void> {
    if (FakeSmtpTransport.failWith) throw FakeSmtpTransport.failWith;
    this.sent.push(mail);
  }
}

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (options: TransportOptions) => new FakeSmtpTransport(options),
  },
}));

const baseConfig = {
  host: 'smtp.test.com',
  port: 587,
  user: 'smtp-user',
  pass: 'smtp-pass',
  from: 'no-reply@nossagrana.test',
  fromName: 'NossaGrana',
};

describe('SmtpEmailSender', () => {
  beforeEach(() => {
    FakeSmtpTransport.created = [];
    FakeSmtpTransport.instances = [];
    FakeSmtpTransport.failWith = null;
  });

  it('cria o transport com host, porta e credenciais da config', () => {
    new SmtpEmailSender(baseConfig);

    expect(FakeSmtpTransport.created).toEqual([
      {
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: { user: 'smtp-user', pass: 'smtp-pass' },
      },
    ]);
  });

  it('usa conexão segura (TLS implícito) apenas na porta 465', () => {
    new SmtpEmailSender({ ...baseConfig, port: 465 });

    expect(FakeSmtpTransport.created[0].secure).toBe(true);
  });

  it('envia o e-mail com remetente formatado "Nome" <email>', async () => {
    const sender = new SmtpEmailSender(baseConfig);

    await sender.send({ to: 'user@test.com', subject: 'Assunto', html: '<p>Olá</p>' });

    expect(FakeSmtpTransport.instances[0].sent).toEqual([
      {
        from: '"NossaGrana" <no-reply@nossagrana.test>',
        to: 'user@test.com',
        subject: 'Assunto',
        html: '<p>Olá</p>',
      },
    ]);
  });

  it('repassa a rejeição quando o transport falha ao enviar', async () => {
    FakeSmtpTransport.failWith = new Error('SMTP indisponível');
    const sender = new SmtpEmailSender(baseConfig);

    await expect(
      sender.send({ to: 'user@test.com', subject: 'Assunto', html: '<p>Olá</p>' }),
    ).rejects.toThrow('SMTP indisponível');
  });
});
