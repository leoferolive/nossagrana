/** Campos do erro do driver `postgres` que o projeto lê. */
export interface ErroPostgres {
  code?: unknown;
  constraint_name?: unknown;
  query?: unknown;
  cause?: unknown;
}

/**
 * O Drizzle embrulha o erro do driver em `DrizzleQueryError.cause`. Percorre até
 * 3 níveis e devolve o primeiro erro com o SQLSTATE pedido, ou `null`.
 *
 * @example encontrarErroPostgres(erro, '23505')?.constraint_name // violação de índice único
 */
export function encontrarErroPostgres(erro: unknown, sqlstate: string): ErroPostgres | null {
  let atual: unknown = erro;
  for (let nivel = 0; nivel < 3 && atual instanceof Error; nivel++) {
    const candidato = atual as ErroPostgres;
    if (candidato.code === sqlstate) return candidato;
    atual = candidato.cause;
  }
  return null;
}
