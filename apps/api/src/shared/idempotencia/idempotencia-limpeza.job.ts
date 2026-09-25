import cron from 'node-cron';

import { db } from '../../db/client.js';
import { DrizzleIdempotenciaRepository } from './idempotencia.repository.js';
import type { IdempotenciaRepository } from './idempotencia.types.js';

/**
 * De hora em hora: com janela de replay de 24h, uma chave fica no máximo ~25h
 * na tabela. O DELETE usa o índice de `criado_em` e apaga só expiradas — barato
 * e seguro de rodar em paralelo com requisições (não toca chaves na janela).
 */
export const CRON_LIMPEZA_IDEMPOTENCIA = '17 * * * *';

/** Subconjunto do logger do Fastify (`app.log`): logs em JSON estruturado. */
export interface LogDaLimpeza {
  info(dados: object, mensagem: string): void;
  error(dados: object, mensagem: string): void;
}

export type AgendadorCron = (
  expressao: string,
  tarefa: () => Promise<void>,
  opcoes: { timezone: string },
) => void;

const agendarComNodeCron: AgendadorCron = (expressao, tarefa, opcoes) => {
  cron.schedule(expressao, tarefa, opcoes);
};

/** Uma execução da limpeza; falha é logada e a próxima execução tenta de novo. */
export async function limparChavesExpiradas(
  repositorio: Pick<IdempotenciaRepository, 'removerExpiradas'>,
  log: LogDaLimpeza,
): Promise<number> {
  try {
    const removidas = await repositorio.removerExpiradas();
    if (removidas > 0) log.info({ removidas }, 'Chaves de idempotência expiradas removidas');
    return removidas;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    log.error({ erro: mensagem }, 'Falha ao limpar chaves de idempotência');
    return 0;
  }
}

/** Agenda a limpeza (em `server.ts`, depois do `listen`, como os demais jobs). */
export function iniciarLimpezaIdempotenciaJob(
  log: LogDaLimpeza,
  repositorio: Pick<IdempotenciaRepository, 'removerExpiradas'> = new DrizzleIdempotenciaRepository(
    db,
  ),
  agendar: AgendadorCron = agendarComNodeCron,
): void {
  agendar(
    CRON_LIMPEZA_IDEMPOTENCIA,
    async () => {
      await limparChavesExpiradas(repositorio, log);
    },
    { timezone: 'America/Sao_Paulo' },
  );
}
