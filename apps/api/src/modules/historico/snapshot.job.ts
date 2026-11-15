import cron from 'node-cron';

import { DrizzleHistoricoRepository } from './historico.repository.js';
import type { HistoricoRepository } from './historico.types.js';
import { FUSO_FECHAMENTO, ehUltimoDiaDoMes, getMesReferencia } from './snapshot.calendario.js';
import {
  SNAPSHOT_BACKOFF_BASE_MS,
  SNAPSHOT_BATCH_SIZE,
  SNAPSHOT_MAX_TENTATIVAS,
  executarSnapshotsEmLote,
  type LogDoJobSnapshot,
  type RelatorioSnapshot,
} from './snapshot.lote.js';
import { SnapshotService } from './snapshot.service.js';

export interface DependenciasDoJob {
  repo: HistoricoRepository;
  log?: LogDoJobSnapshot;
  agora: () => Date;
  aguardar: (ms: number) => Promise<void>;
}

export interface OpcoesDoSnapshot {
  /** `YYYY-MM`. Padrão: mês do dia que está fechando (fuso de Brasília). Permite reprocessar mês passado. */
  mesReferencia?: string;
}

const LOG_NAO_OPERACIONAL: LogDoJobSnapshot = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function dependenciasPadrao(log?: LogDoJobSnapshot): DependenciasDoJob {
  return {
    repo: new DrizzleHistoricoRepository(),
    log,
    agora: () => new Date(),
    aguardar: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * Gera snapshots das famílias ativas e devolve o relatório (`falhou` = qualquer
 * família sem snapshot após os retries). Snapshot existente nunca é recalculado.
 */
export async function gerarSnapshotsParaTodasFamilias(
  opcoes: OpcoesDoSnapshot = {},
  deps: DependenciasDoJob = dependenciasPadrao(),
): Promise<RelatorioSnapshot> {
  const log = deps.log ?? LOG_NAO_OPERACIONAL;
  const mesReferencia = opcoes.mesReferencia ?? getMesReferencia(deps.agora(), FUSO_FECHAMENTO);
  const familiaIds = await deps.repo.listFamiliaIdsAtivas();
  return executarSnapshotsEmLote(familiaIds, mesReferencia, {
    gerador: new SnapshotService(deps.repo, log),
    log,
    aguardar: deps.aguardar,
    tentativasMaximas: SNAPSHOT_MAX_TENTATIVAS,
    backoffBaseMs: SNAPSHOT_BACKOFF_BASE_MS,
    tamanhoDoLote: SNAPSHOT_BATCH_SIZE,
  });
}

/**
 * Tick do cron: só age no último dia do mês em Brasília. Roda dentro do
 * processo da API, então nunca propaga erro: falhas viram log em `error`.
 */
export async function executarCicloMensal(
  deps: DependenciasDoJob,
): Promise<RelatorioSnapshot | null> {
  if (!ehUltimoDiaDoMes(deps.agora(), FUSO_FECHAMENTO)) return null;
  try {
    return await gerarSnapshotsParaTodasFamilias({}, deps);
  } catch (erro) {
    const mensagem = erro instanceof Error ? (erro.message.split('\n')[0] ?? '') : String(erro);
    (deps.log ?? LOG_NAO_OPERACIONAL).error(
      { erro: mensagem.slice(0, 200) },
      'Job de snapshot mensal abortado antes de processar as famílias',
    );
    return null;
  }
}

// 23:55 BRT dos dias 28-31; a checagem do último dia é feita no fuso de Brasília, não no do pod (UTC).
export function iniciarSnapshotJob(log?: LogDoJobSnapshot): void {
  cron.schedule(
    '55 23 28-31 * *',
    async () => {
      await executarCicloMensal(dependenciasPadrao(log));
    },
    { timezone: FUSO_FECHAMENTO },
  );
}
