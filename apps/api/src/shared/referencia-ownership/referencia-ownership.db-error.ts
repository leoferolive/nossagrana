import type { EntidadeReferenciada } from './referencia-ownership.types.js';
import { ReferenciaInvalidaError, ROTULO_ENTIDADE } from './referencia-ownership.validator.js';

const SQLSTATE_FOREIGN_KEY_VIOLATION = '23503';

/**
 * FKs compostas `(<ref>_id, familia_id)` da migration 0009 (issue #58). Só
 * elas viram erro de domínio: outras FKs continuam como erro inesperado.
 */
const ENTIDADE_POR_FK_COMPOSTA: Record<string, EntidadeReferenciada> = {
  transacoes_categoria_familia_fk: 'categoria',
  transacoes_metodo_pagamento_familia_fk: 'metodoPagamento',
  transacoes_cofrinho_familia_fk: 'cofrinho',
  transacoes_transacao_pai_familia_fk: 'transacao',
  orcamento_categoria_categoria_familia_fk: 'categoria',
  templates_transacao_categoria_familia_fk: 'categoria',
  templates_transacao_metodo_pagamento_familia_fk: 'metodoPagamento',
  templates_transacao_cofrinho_familia_fk: 'cofrinho',
  movimentacoes_cofrinho_cofrinho_familia_fk: 'cofrinho',
  movimentacoes_cofrinho_transacao_familia_fk: 'transacao',
};

interface ErroDoBanco {
  code?: unknown;
  constraint_name?: unknown;
  query?: unknown;
  cause?: unknown;
}

/** O Drizzle embrulha o erro do driver em `DrizzleQueryError.cause`. */
function erroDoDriver(erro: unknown): ErroDoBanco | null {
  let atual: unknown = erro;
  for (let nivel = 0; nivel < 3 && atual instanceof Error; nivel++) {
    const candidato = atual as ErroDoBanco;
    if (candidato.code === SQLSTATE_FOREIGN_KEY_VIOLATION) return candidato;
    atual = candidato.cause;
  }
  return null;
}

/**
 * A mesma constraint dispara no INSERT/UPDATE do filho (referência inválida) e
 * no DELETE do pai ainda referenciado; só o primeiro é erro do cliente. O SQL
 * gerado pelo Drizzle é o sinal estável — a mensagem do PostgreSQL depende de
 * `lc_messages`.
 */
function ehEscritaNoFilho(query: unknown): boolean {
  return typeof query === 'string' && /^\s*(insert|update)\b/i.test(query);
}

/**
 * Traduz a violação de uma FK composta por família (SQLSTATE 23503) em
 * `ReferenciaInvalidaError` (422), sem ecoar SQL, constraint ou parâmetros.
 * Qualquer outro erro é devolvido intacto.
 *
 * @example throw traduzirViolacaoReferencia(erro) // no handler de erro central
 */
export function traduzirViolacaoReferencia(erro: unknown): unknown {
  const driver = erroDoDriver(erro);
  if (!driver || typeof driver.constraint_name !== 'string') return erro;
  const entidade = ENTIDADE_POR_FK_COMPOSTA[driver.constraint_name];
  const query = driver.query ?? (erro as ErroDoBanco).query;
  if (!entidade || !ehEscritaNoFilho(query)) return erro;
  return new ReferenciaInvalidaError(
    entidade,
    'nao_encontrada',
    `Referência inválida (${ROTULO_ENTIDADE[entidade]}): o ID informado não existe na família ativa`,
  );
}
