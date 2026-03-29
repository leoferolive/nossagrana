import type { EmailPayload, EmailSender } from './email.types.js';

export class ConsoleEmailSender implements EmailSender {
  async send(payload: EmailPayload): Promise<void> {
    console.log(`[EMAIL] To: ${payload.to} | Subject: ${payload.subject}`);
  }
}
