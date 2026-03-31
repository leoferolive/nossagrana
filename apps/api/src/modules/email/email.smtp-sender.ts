import nodemailer from 'nodemailer';

import type { EmailPayload, EmailSender } from './email.types.js';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

export class SmtpEmailSender implements EmailSender {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    this.from = `"${config.fromName}" <${config.from}>`;
  }

  async send(payload: EmailPayload): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
  }
}
