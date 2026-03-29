import type { EmailPayload, EmailSender } from './email.types.js';

export class InMemoryEmailSender implements EmailSender {
  public readonly sent: EmailPayload[] = [];

  async send(payload: EmailPayload): Promise<void> {
    this.sent.push(payload);
  }

  clear(): void {
    this.sent.length = 0;
  }
}
