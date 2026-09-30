import cron from 'node-cron';

import { db } from '../../db/client.js';
import { DrizzleRevokedTokenRepository } from './revoked-token.repository.js';

// Executa diariamente a meia-noite para limpar tokens expirados
export function iniciarRevokedTokenCleanupJob(): void {
  cron.schedule(
    '0 0 * * *',
    async () => {
      const repo = new DrizzleRevokedTokenRepository(db);
      const removed = await repo.cleanupExpired();
      if (removed > 0) {
        console.log(`[revoked-token-cleanup] Removidos ${removed} tokens expirados`);
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
