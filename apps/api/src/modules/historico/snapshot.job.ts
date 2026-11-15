import cron from 'node-cron';

import { DrizzleHistoricoRepository } from './historico.repository.js';
import type { HistoricoRepository } from './historico.types.js';
import { FUSO_FECHAMENTO, ehUltimoDiaDoMes, getMesReferencia } from './snapshot.calendario.js';
import {
  SNAPSHOT_BACKOFF_BASE_MS,
  SNAPSHOT_BATCH_SIZE,
  SNAPSHOT_MAX_TENTATIVAS,
  descreverErro,
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

const FORMATO_MES_REFERENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Mês informado precisa ser `YYYY-MM` válido e não posterior ao mês que está fechando agora. */
function resolverMesReferencia(informado: string | undefined, agora: Date): string {
  const atual = getMesReferencia(agora, FUSO_FECHAMENTO);
  if (informado === undefined) return atual;
  if (!FORMATO_MES_REFERENCIA.test(informado)) {
    throw new Error(
      `mesReferencia inválido: recebido "${informado}", esperado formato YYYY-MM (ex.: ${atual})`,
    );
  }
  if (informado > atual) {
    throw new Error(
      `mesReferencia posterior ao mês corrente: recebido "${informado}", esperado no máximo ${atual} (YYYY-MM)`,
    );
  }
  return informado;
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
  const mesReferencia = resolverMesReferencia(opcoes.mesReferencia, deps.agora());
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
  const agora = deps.agora();
  if (!ehUltimoDiaDoMes(agora, FUSO_FECHAMENTO)) return null;
  try {
    const mesReferencia = getMesReferencia(agora, FUSO_FECHAMENTO);
    return await gerarSnapshotsParaTodasFamilias(
      { mesReferencia },
      { ...deps, agora: () => agora },
    );
  } catch (erro) {
    (deps.log ?? LOG_NAO_OPERACIONAL).error(
      { erro: descreverErro(erro) },
      'Job de snapshot mensal abortado antes de processar as famílias',
    );
    return null;
  }
}

// 23:55 BRT dos dias 28-31. DST: Intl e node-cron dependem do tzdata do Node; se as regras
// de horário de verão mudarem, basta atualizar a imagem/Node. A checagem do último dia é feita no fuso de Brasília, não no do pod (UTC).
export function iniciarSnapshotJob(log?: LogDoJobSnapshot): void {
  cron.schedule(
    '55 23 28-31 * *',
    async () => {
      await executarCicloMensal(dependenciasPadrao(log));
    },
    { timezone: FUSO_FECHAMENTO },
  );
}
