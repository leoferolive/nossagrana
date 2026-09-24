import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';

import { traduzirViolacaoReferencia } from './referencia-ownership.db-error.js';
import type { EntidadeReferenciada } from './referencia-ownership.types.js';
import { ReferenciaInvalidaError } from './referencia-ownership.validator.js';

/**
 * Fake do erro do driver `postgres` (PostgresError): SQLSTATE em `code`, nome
 * da constraint em `constraint_name` e o SQL executado em `query`.
 */
class PostgresErrorFake extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly constraint_name: string | undefined,
    readonly query: string,
  ) {
    super(message);
    this.name = 'PostgresError';
  }
}

const SQL_INSERT = 'insert into "transacoes" ("id", "categoria_id") values ($1, $2)';
const PARAM_SENSIVEL = 'id-de-outra-familia-3f9a';

function violacaoFk(constraint: string, query = SQL_INSERT): PostgresErrorFake {
  return new PostgresErrorFake(
    `insert or update on table "transacoes" violates foreign key constraint "${constraint}"`,
    '23503',
    constraint,
    query,
  );
}

function viaDrizzle(causa: PostgresErrorFake): DrizzleQueryError {
  return new DrizzleQueryError(causa.query, [PARAM_SENSIVEL], causa);
}

describe('traduzirViolacaoReferencia', () => {
  it.each<[string, EntidadeReferenciada]>([
    ['transacoes_categoria_familia_fk', 'categoria'],
    ['transacoes_metodo_pagamento_familia_fk', 'metodoPagamento'],
    ['transacoes_cofrinho_familia_fk', 'cofrinho'],
    ['transacoes_transacao_pai_familia_fk', 'transacao'],
    ['orcamento_categoria_categoria_familia_fk', 'categoria'],
    ['templates_transacao_categoria_familia_fk', 'categoria'],
    ['templates_transacao_metodo_pagamento_familia_fk', 'metodoPagamento'],
    ['templates_transacao_cofrinho_familia_fk', 'cofrinho'],
    ['movimentacoes_cofrinho_cofrinho_familia_fk', 'cofrinho'],
    ['movimentacoes_cofrinho_transacao_familia_fk', 'transacao'],
  ])('traduz violação de %s em ReferenciaInvalidaError (%s)', (constraint, entidade) => {
    const traduzido = traduzirViolacaoReferencia(viaDrizzle(violacaoFk(constraint)));

    expect(traduzido).toBeInstanceOf(ReferenciaInvalidaError);
    expect(traduzido).toMatchObject({
      entidade,
      motivo: 'nao_encontrada',
      statusCode: 422,
      code: 'REFERENCIA_INVALIDA',
    });
  });

  it('não expõe SQL, constraint nem parâmetros na mensagem', () => {
    const traduzido = traduzirViolacaoReferencia(
      viaDrizzle(violacaoFk('transacoes_categoria_familia_fk')),
    ) as Error;

    expect(traduzido.message).toBe(
      'Referência inválida (categoria): o ID informado não existe na família ativa',
    );
    expect(traduzido.message).not.toMatch(/insert|transacoes|_fk|foreign key/i);
    expect(traduzido.message).not.toContain(PARAM_SENSIVEL);
  });

  it('traduz também o erro do driver sem o wrapper do Drizzle', () => {
    const traduzido = traduzirViolacaoReferencia(
      violacaoFk('templates_transacao_cofrinho_familia_fk'),
    );

    expect(traduzido).toBeInstanceOf(ReferenciaInvalidaError);
  });

  it('traduz violação em UPDATE', () => {
    const erro = violacaoFk(
      'orcamento_categoria_categoria_familia_fk',
      'update "orcamento_categoria" set "categoria_id" = $1 where "id" = $2',
    );

    expect(traduzirViolacaoReferencia(viaDrizzle(erro))).toBeInstanceOf(ReferenciaInvalidaError);
  });

  it('mantém o erro original quando a violação vem de um DELETE (registro ainda referenciado)', () => {
    const erro = viaDrizzle(
      violacaoFk(
        'movimentacoes_cofrinho_transacao_familia_fk',
        'delete from "transacoes" where "id" = $1',
      ),
    );

    expect(traduzirViolacaoReferencia(erro)).toBe(erro);
  });

  it('mantém o erro original para FK fora das compostas por família', () => {
    const erro = viaDrizzle(violacaoFk('transacoes_usuario_registrou_id_users_id_fk'));

    expect(traduzirViolacaoReferencia(erro)).toBe(erro);
  });

  it('mantém o erro original para outro SQLSTATE', () => {
    const erro = new PostgresErrorFake(
      'duplicate key value violates unique constraint',
      '23505',
      'transacoes_categoria_familia_fk',
      SQL_INSERT,
    );

    expect(traduzirViolacaoReferencia(erro)).toBe(erro);
  });

  it.each([null, undefined, 'falhou', 42, new Error('boom')])(
    'mantém valores que não são erro do banco (%s)',
    (erro) => {
      expect(traduzirViolacaoReferencia(erro)).toBe(erro);
    },
  );
});
