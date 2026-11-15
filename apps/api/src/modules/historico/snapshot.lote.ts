import { chunk } from '../../utils/array.js';
import type { LogDoSnapshot } from './snapshot.service.js';

/** Quantas famílias são processadas em paralelo. */
export const SNAPSHOT_BATCH_SIZE = 50;
/** Tentativas por família (1 inicial + 2 retries). */
export const SNAPSHOT_MAX_TENTATIVAS = 3;
/** Backoff exponencial entre tentativas: base * 2^(tentativa-1) => 500ms, 1000ms. */
export const SNAPSHOT_BACKOFF_BASE_MS = 500;
/** Limite da mensagem de erro logada/reportada. */
export const LIMITE_MENSAGEM_ERRO = 200;

/** Logger do job: subconjunto do logger do Fastify (`app.log`). */
export interface LogDoJobSnapshot extends LogDoSnapshot {
  warn(dados: object, mensagem: string): void;
  error(dados: object, mensagem: string): void;
}

export interface GeradorDeSnapshot {
  gerarSnapshot(familiaId: string, mesReferencia: string): Promise<{ criado: boolean }>;
}

export type StatusFamilia = 'criado' | 'existente' | 'falhou';

export interface ResultadoFamilia {
  familiaId: string;
  status: StatusFamilia;
  tentativas: number;
  erro?: string;
}

/**
 * Relatório do fechamento. Critério de job falho: qualquer família sem
 * snapshot após esgotar as tentativas (`falhas.length > 0`) => `falhou = true`.
 * Sucesso parcial nunca é reportado como sucesso.
 */
export interface RelatorioSnapshot {
  mesReferencia: string;
  total: number;
  criados: number;
  existentes: number;
  falhas: ResultadoFamilia[];
  resultados: ResultadoFamilia[];
  falhou: boolean;
}

export interface DependenciasDoLote {
  gerador: GeradorDeSnapshot;
  log: LogDoJobSnapshot;
  /** Espera injetável: testes não usam timers reais. */
  aguardar: (ms: number) => Promise<void>;
  tentativasMaximas: number;
  backoffBaseMs: number;
  tamanhoDoLote: number;
}

/** Só a 1ª linha, truncada: erros do driver trazem os parâmetros da query (valores financeiros) nas linhas seguintes. */
export function descreverErro(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return (mensagem.split('\n')[0] ?? '').slice(0, LIMITE_MENSAGEM_ERRO);
}

/** Uma tentativa: devolve o resultado em caso de sucesso ou a mensagem do erro. */
async function tentarUmaVez(
  familiaId: string,
  mesReferencia: string,
  tentativa: number,
  gerador: GeradorDeSnapshot,
): Promise<ResultadoFamilia | string> {
  try {
    const { criado } = await gerador.gerarSnapshot(familiaId, mesReferencia);
    return { familiaId, status: criado ? 'criado' : 'existente', tentativas: tentativa };
  } catch (erro) {
    return descreverErro(erro);
  }
}

async function esperarSeHouverProxima(tentativa: number, deps: DependenciasDoLote): Promise<void> {
  if (tentativa >= deps.tentativasMaximas) return;
  await deps.aguardar(deps.backoffBaseMs * 2 ** (tentativa - 1));
}

async function processarFamilia(
  familiaId: string,
  mesReferencia: string,
  deps: DependenciasDoLote,
): Promise<ResultadoFamilia> {
  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= deps.tentativasMaximas; tentativa++) {
    const saida = await tentarUmaVez(familiaId, mesReferencia, tentativa, deps.gerador);
    if (typeof saida !== 'string') return saida;
    ultimoErro = saida;
    await esperarSeHouverProxima(tentativa, deps);
  }
  return { familiaId, status: 'falhou', tentativas: deps.tentativasMaximas, erro: ultimoErro };
}

function montarRelatorio(mesReferencia: string, resultados: ResultadoFamilia[]): RelatorioSnapshot {
  const falhas = resultados.filter((r) => r.status === 'falhou');
  return {
    mesReferencia,
    total: resultados.length,
    criados: resultados.filter((r) => r.status === 'criado').length,
    existentes: resultados.filter((r) => r.status === 'existente').length,
    falhas,
    resultados,
    falhou: falhas.length > 0,
  };
}

function registrarFalhas(relatorio: RelatorioSnapshot, log: LogDoJobSnapshot): void {
  const { mesReferencia } = relatorio;
  for (const f of relatorio.falhas) {
    log.error(
      { familiaId: f.familiaId, mesReferencia, tentativas: f.tentativas, erro: f.erro },
      'Snapshot mensal falhou após esgotar as tentativas',
    );
  }
  if (!relatorio.falhou) return;
  log.error(
    {
      mesReferencia,
      total: relatorio.total,
      criados: relatorio.criados,
      existentes: relatorio.existentes,
      falhas: relatorio.falhas.length,
    },
    'Job de snapshot mensal falhou: há famílias sem snapshot',
  );
}

/** Gera o snapshot de cada família em lotes; falha de uma família (após retries) não afeta as demais. */
export async function executarSnapshotsEmLote(
  familiaIds: string[],
  mesReferencia: string,
  deps: DependenciasDoLote,
): Promise<RelatorioSnapshot> {
  const resultados: ResultadoFamilia[] = [];
  for (const lote of chunk(familiaIds, deps.tamanhoDoLote)) {
    resultados.push(
      ...(await Promise.all(lote.map((id) => processarFamilia(id, mesReferencia, deps)))),
    );
  }
  const relatorio = montarRelatorio(mesReferencia, resultados);
  registrarFalhas(relatorio, deps.log);
  return relatorio;
}
