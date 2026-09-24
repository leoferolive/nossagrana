import { EfeitoPosCommitError } from './escopo-transacional.js';
import type { ContextoUnidadeDeTrabalho, UnitOfWork } from './unit-of-work.types.js';

/**
 * SQLSTATEs de disputa por linha que o cliente pode simplesmente repetir:
 * lock_timeout estourado, deadlock detectado e falha de serialização.
 */
const SQLSTATE_CONFLITO = new Set(['55P03', '40P01', '40001']);

/** Disputa de concorrência (lock/deadlock): nada foi gravado, pode repetir. */
export class ConflitoDeConcorrenciaError extends Error {
  constructor(readonly sqlstate: string) {
    super(
      'Operação concorrente em andamento no mesmo registro: nada foi gravado, ' +
        'esperado repetir a requisição em instantes',
    );
    this.name = 'ConflitoDeConcorrenciaError';
  }
}

interface ErroComCodigo {
  code?: unknown;
  cause?: unknown;
}

/** Profundidade da cadeia `cause`: embrulho externo → pós-commit → Drizzle → driver. */
const NIVEIS_DE_CAUSA = 5;

/**
 * O Drizzle embrulha o erro do driver em `DrizzleQueryError.cause`. Um
 * `EfeitoPosCommitError` na cadeia interrompe a busca: os dados JÁ foram
 * confirmados, e "nada foi gravado, repita" induziria retry duplicado.
 */
function sqlstateDeConflito(erro: unknown): string | null {
  let atual: unknown = erro;
  for (let nivel = 0; nivel < NIVEIS_DE_CAUSA && atual instanceof Error; nivel++) {
    if (atual instanceof EfeitoPosCommitError) return null;
    const { code, cause } = atual as ErroComCodigo;
    if (typeof code === 'string' && SQLSTATE_CONFLITO.has(code)) return code;
    atual = cause;
  }
  return null;
}

/**
 * Traduz lock timeout/deadlock/serialização em `ConflitoDeConcorrenciaError`
 * (sem SQL, parâmetros ou constraint na mensagem); outros erros passam intactos.
 */
export function traduzirConflitoDeConcorrencia(erro: unknown): unknown {
  const sqlstate = sqlstateDeConflito(erro);
  return sqlstate ? new ConflitoDeConcorrenciaError(sqlstate) : erro;
}

/**
 * Decorator da Unit of Work: o rollback já aconteceu quando o erro chega aqui,
 * então o service só vê o erro de domínio tratável (409), nunca SQLSTATE.
 *
 * @example new UnitOfWorkComConflitoTraduzido(new DrizzleUnitOfWork(db, criarRepos))
 */
export class UnitOfWorkComConflitoTraduzido<R> implements UnitOfWork<R> {
  constructor(private readonly interna: UnitOfWork<R>) {}

  async executar<T>(trabalho: (contexto: ContextoUnidadeDeTrabalho<R>) => Promise<T>): Promise<T> {
    try {
      return await this.interna.executar(trabalho);
    } catch (erro) {
      throw traduzirConflitoDeConcorrencia(erro);
    }
  }
}
