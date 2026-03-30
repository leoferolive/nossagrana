import type { EmailPayload, EmailSender } from './email.types.js';

/* v8 ignore start -- dev-only sender; logic is trivial */
export class ConsoleEmailSender implements EmailSender {
  async send(payload: EmailPayload): Promise<void> {
    console.log(`[EMAIL] To: ${payload.to} | Subject: ${payload.subject}`);
  }
}
