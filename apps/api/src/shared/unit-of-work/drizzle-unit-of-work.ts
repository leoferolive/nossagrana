import { EscopoTransacional, isolarUnidade } from './escopo-transacional.js';
import type { ContextoUnidadeDeTrabalho, UnitOfWork } from './unit-of-work.types.js';

/**
 * Contrato mínimo do `db.transaction` do Drizzle (postgres-js): BEGIN numa
 * conexão reservada, COMMIT se o callback resolver, ROLLBACK e rethrow se
 * rejeitar; a conexão volta ao pool nos dois casos (`sql.begin`).
 */
interface BancoComTransacao<TX> {
  transaction<T>(trabalho: (tx: TX) => Promise<T>): Promise<T>;
}

/**
 * Adapter de produção: uma chamada a `executar` = exatamente um
 * `db.transaction`. Os repositórios são construídos sobre o `tx` a cada
 * execução, então toda escrita do trabalho cai no mesmo commit/rollback.
 *
 * @example
 * new DrizzleUnitOfWork(db, (tx) => ({ transacoes: new DrizzleTransacaoRepository(tx) }));
 */
export class DrizzleUnitOfWork<TX, R extends Record<string, object>> implements UnitOfWork<R> {
  constructor(
    private readonly banco: BancoComTransacao<TX>,
    private readonly criarRepos: (tx: TX) => R,
  ) {}

  async executar<T>(trabalho: (contexto: ContextoUnidadeDeTrabalho<R>) => Promise<T>): Promise<T> {
    const [resultado, escopo] = await isolarUnidade(() =>
      this.banco.transaction(async (tx) => {
        const escopoTx = new EscopoTransacional(this.criarRepos(tx));
        return [await escopoTx.rodar(trabalho), escopoTx] as const;
      }),
    );
    // Fora do callback: o `transaction` já resolveu, logo o COMMIT aconteceu.
    await escopo.executarEfeitos();
    return resultado;
  }
}
