import cron from 'node-cron';

import { db } from '../../db/client.js';
import { familias } from '../../db/schema.js';
import { DrizzleHistoricoRepository } from './historico.repository.js';
import { SnapshotService } from './snapshot.service.js';

function getMesReferencia(): string {
  const now = new Date();
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const ano = partes.find((p) => p.type === 'year')!.value;
  const mes = partes.find((p) => p.type === 'month')!.value;
  return `${ano}-${mes}`;
}

export async function gerarSnapshotsParaTodasFamilias(): Promise<void> {
  const mesReferencia = getMesReferencia();
  const repo = new DrizzleHistoricoRepository();
  const service = new SnapshotService(repo);

  const todasFamilias = await db.select({ id: familias.id }).from(familias);
  await Promise.allSettled(
    todasFamilias.map((f) => service.gerarSnapshot(f.id, mesReferencia)),
  );
}

// Executa às 23:55 do último dia do mês (checa se amanhã é dia 1)
export function iniciarSnapshotJob(): void {
  cron.schedule(
    '55 23 28-31 * *',
    async () => {
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      if (amanha.getDate() === 1) {
        await gerarSnapshotsParaTodasFamilias();
      }
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
