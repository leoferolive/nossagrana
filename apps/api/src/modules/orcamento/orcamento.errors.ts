import { ErroComEnvelopeHttp } from '../../shared/http/erro-com-envelope.js';

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

interface ErroDoDriver {
  code?: unknown;
  constraint_name?: unknown;
  cause?: unknown;
}

/** O Drizzle embrulha o erro do driver em `cause`; confere SQLSTATE 23505 e o nome do índice. */
export function violaIndiceDaVigencia(erro: unknown): boolean {
  let atual: unknown = erro;
  for (let nivel = 0; nivel < 3 && atual instanceof Error; nivel++) {
    const candidato = atual as ErroDoDriver;
    if (candidato.code === SQLSTATE_UNIQUE_VIOLATION) {
      return candidato.constraint_name === INDICE_VIGENCIA_UNICA;
    }
    atual = candidato.cause;
  }
  return false;
}
