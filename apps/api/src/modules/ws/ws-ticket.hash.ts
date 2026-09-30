import { createHash } from 'node:crypto';

/** SHA-256 em hex do ticket; é a única forma em que ele é persistido. */
export function hashWsTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}
