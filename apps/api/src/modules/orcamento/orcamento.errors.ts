import { ErroComEnvelopeHttp } from '../../shared/http/erro-com-envelope.js';
import { encontrarErroPostgres } from '../../shared/postgres/encontrar-erro-postgres.js';

export const INDICE_VIGENCIA_UNICA = 'orcamento_categoria_vigencia_uq';
const SQLSTATE_UNIQUE_VIOLATION = '23505';

/**
 * Já existe um limite da categoria nessa vigência e ele não pôde ser atualizado
 * no lugar (por exemplo, o mês pedido já foi encerrado). O índice único da
 * migration 0015 é a última barreira; o handler central responde 409.
 */
export class LimiteVigenciaDuplicadaError extends ErroComEnvelopeHttp {
  readonly statusHttp = 409;
  readonly code = 'LIMITE_VIGENCIA_DUPLICADA';

  constructor(categoriaId: string, vigenciaInicio: string) {
    super(
      `Já existe um limite da categoria ${categoriaId} com início em ${vigenciaInicio}: edite o limite desse mês em vez de criar outro`,
    );
  }
}

/** Violação (23505) do índice único da vigência; outros índices únicos não contam. */
export function violaIndiceDaVigencia(erro: unknown): boolean {
  const driver = encontrarErroPostgres(erro, SQLSTATE_UNIQUE_VIOLATION);
  return driver?.constraint_name === INDICE_VIGENCIA_UNICA;
}

/**
 * A vigência pedida começa antes do limite vigente. Encerrar o vigente e inserir
 * outro faria os dois valerem no mês do vigente (a lista mostraria dois cartões);
 * por isso nada é escrito. O 409 diz os dois meses para o cliente corrigir.
 */
export class LimiteVigenciaAnteriorError extends ErroComEnvelopeHttp {
  readonly statusHttp = 409;
  readonly code = 'LIMITE_VIGENCIA_ANTERIOR';

  constructor(vigenciaPedida: string, inicioVigente: string) {
    super(
      `Vigência inválida: recebido início em ${vigenciaPedida}, esperado ${inicioVigente} ou posterior (o limite vigente começa em ${inicioVigente})`,
    );
  }
}
