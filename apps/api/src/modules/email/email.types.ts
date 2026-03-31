export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface EmailSender {
  send(payload: EmailPayload): Promise<void>;
}

export type EmailTemplate = 'password-reset' | 'email-verification' | 'magic-link';

export interface TemplateData {
  userName: string;
  actionUrl: string;
  expirationMinutes?: number;
}
