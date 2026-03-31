import type { EmailPayload, EmailSender } from './email.types.js';

export class InMemoryEmailSender implements EmailSender {
  public readonly sent: EmailPayload[] = [];

  async send(payload: EmailPayload): Promise<void> {
    this.sent.push(payload);
  }

  /* v8 ignore next 3 -- test utility method */
  clear(): void {
    this.sent.length = 0;
  }
}
