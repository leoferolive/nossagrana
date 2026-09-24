import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { traduzirViolacaoReferencia } from '../../shared/referencia-ownership/referencia-ownership.db-error.js';
import { ReferenciaInvalidaError } from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import { transacoes } from '../schema.js';
import { inserirTransacaoFilha, semearFamilia, type FamiliaSemeada } from './pg-fixtures.js';
import {
  aplicarMigrations,
  aplicarMigrationsAntesDe,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Integridade referencial por família no PostgreSQL real (issue #58).
 * Roda só via `pnpm --filter api test:pg` (ver scripts/test-pg.sh).
 */
const MIGRATION_FK_COMPOSTAS = '0009_familia_fk_compostas';

const TABELAS = [
  'transacoes',
  'orcamento_categoria',
  'templates_transacao',
  'movimentacoes_cofrinho',
] as const;
type Tabela = (typeof TABELAS)[number];
type Referencia = 'categoriaId' | 'metodoPagamentoId' | 'cofrinhoId' | 'transacaoId';

interface FkComposta {
  tabela: Tabela;
  coluna: string;
  referencia: Referencia;
  constraint: string;
}

const FKS_COMPOSTAS: FkComposta[] = [
  {
    tabela: 'transacoes',
    coluna: 'categoria_id',
    referencia: 'categoriaId',
    constraint: 'transacoes_categoria_familia_fk',
  },
  {
    tabela: 'transacoes',
    coluna: 'metodo_pagamento_id',
    referencia: 'metodoPagamentoId',
    constraint: 'transacoes_metodo_pagamento_familia_fk',
  },
  {
    tabela: 'transacoes',
    coluna: 'cofrinho_id',
    referencia: 'cofrinhoId',
    constraint: 'transacoes_cofrinho_familia_fk',
  },
  {
    tabela: 'transacoes',
    coluna: 'transacao_pai_id',
    referencia: 'transacaoId',
    constraint: 'transacoes_transacao_pai_familia_fk',
  },
  {
    tabela: 'orcamento_categoria',
    coluna: 'categoria_id',
    referencia: 'categoriaId',
    constraint: 'orcamento_categoria_categoria_familia_fk',
  },
  {
    tabela: 'templates_transacao',
    coluna: 'categoria_id',
    referencia: 'categoriaId',
    constraint: 'templates_transacao_categoria_familia_fk',
  },
  {
    tabela: 'templates_transacao',
    coluna: 'metodo_pagamento_id',
    referencia: 'metodoPagamentoId',
    constraint: 'templates_transacao_metodo_pagamento_familia_fk',
  },
  {
    tabela: 'templates_transacao',
    coluna: 'cofrinho_id',
    referencia: 'cofrinhoId',
    constraint: 'templates_transacao_cofrinho_familia_fk',
  },
  {
    tabela: 'movimentacoes_cofrinho',
    coluna: 'cofrinho_id',
    referencia: 'cofrinhoId',
    constraint: 'movimentacoes_cofrinho_cofrinho_familia_fk',
  },
  {
    tabela: 'movimentacoes_cofrinho',
    coluna: 'transacao_id',
    referencia: 'transacaoId',
    constraint: 'movimentacoes_cofrinho_transacao_familia_fk',
  },
];

const COLUNAS_ANULAVEIS: Array<[Tabela, string]> = [
  ['transacoes', 'metodo_pagamento_id'],
  ['transacoes', 'cofrinho_id'],
  ['transacoes', 'transacao_pai_id'],
  ['templates_transacao', 'categoria_id'],
  ['templates_transacao', 'metodo_pagamento_id'],
  ['templates_transacao', 'cofrinho_id'],
  ['movimentacoes_cofrinho', 'transacao_id'],
];

/** Linha válida de `tabela` na família `f`, com todas as referências da própria família. */
function linhaValida(tabela: Tabela, f: FamiliaSemeada): Record<string, unknown> {
  const linhas: Record<Tabela, Record<string, unknown>> = {
    transacoes: {
      familia_id: f.familiaId,
      tipo: 'despesa',
      valor: '1.00',
      categoria_id: f.categoriaId,
      data: '2026-09-15',
      mes_referencia: '2026-09',
      metodo_pagamento_id: f.metodoPagamentoId,
      usuario_registrou_id: f.usuarioId,
      transacao_pai_id: f.transacaoId,
      cofrinho_id: f.cofrinhoId,
    },
    orcamento_categoria: {
      familia_id: f.familiaId,
      categoria_id: f.categoriaId,
      valor_limite: '100.00',
      vigencia_inicio: '2026-09',
      criado_por: f.usuarioId,
    },
    templates_transacao: {
      familia_id: f.familiaId,
      nome: `Template ${randomUUID()}`,
      tipo: 'despesa',
      categoria_id: f.categoriaId,
      metodo_pagamento_id: f.metodoPagamentoId,
      cofrinho_id: f.cofrinhoId,
      criado_por: f.usuarioId,
    },
    movimentacoes_cofrinho: {
      familia_id: f.familiaId,
      cofrinho_id: f.cofrinhoId,
      tipo: 'aporte',
      valor: '1.00',
      transacao_id: f.transacaoId,
      registrado_por: f.usuarioId,
      mes_referencia: '2026-09',
    },
  };
  return linhas[tabela];
}

function inserir(sql: postgres.Sql, tabela: Tabela, linha: Record<string, unknown>) {
  return sql`INSERT INTO ${sql(tabela)} ${sql(linha as Record<string, postgres.ParameterOrJSON<never>>)} RETURNING id`;
}

function atualizar(sql: postgres.Sql, tabela: Tabela, id: string, campos: Record<string, unknown>) {
  const set = sql(campos as Record<string, postgres.ParameterOrJSON<never>>);
  return sql`UPDATE ${sql(tabela)} SET ${set} WHERE id = ${id}`;
}

async function idInserido(query: Promise<postgres.Row[]>): Promise<string> {
  const [row] = await query;
  return row?.id as string;
}

describe('FKs compostas (id, familia_id) no PostgreSQL', () => {
  let banco: BancoDescartavel;
  let a: FamiliaSemeada;
  let b: FamiliaSemeada;
  const linhasDeA = {} as Record<Tabela, string>;

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    a = await semearFamilia(banco.sql, 'Ana');
    b = await semearFamilia(banco.sql, 'Bruno');
    for (const tabela of TABELAS) {
      linhasDeA[tabela] = await idInserido(inserir(banco.sql, tabela, linhaValida(tabela, a)));
    }
  });

  afterAll(() => banco?.descartar());

  it.each(TABELAS)(
    'aceita insert e update em %s com referências da mesma família',
    async (tabela) => {
      const linha = linhaValida(tabela, a);
      const id = await idInserido(inserir(banco.sql, tabela, linha));

      await expect(atualizar(banco.sql, tabela, id, linha)).resolves.toBeDefined();
    },
  );

  it.each(FKS_COMPOSTAS)(
    'rejeita INSERT com referência de outra família ($constraint)',
    async ({ tabela, coluna, referencia, constraint }) => {
      const linha = { ...linhaValida(tabela, a), [coluna]: b[referencia] };

      await expect(inserir(banco.sql, tabela, linha)).rejects.toMatchObject({
        code: '23503',
        constraint_name: constraint,
      });
    },
  );

  it.each(FKS_COMPOSTAS)(
    'rejeita UPDATE para referência de outra família ($constraint)',
    async ({ tabela, coluna, referencia, constraint }) => {
      const update = atualizar(banco.sql, tabela, linhasDeA[tabela], { [coluna]: b[referencia] });

      await expect(update).rejects.toMatchObject({ code: '23503', constraint_name: constraint });
    },
  );

  it('rejeita UPDATE que move a linha para outra família mantendo a referência antiga', async () => {
    const id = await idInserido(
      inserir(banco.sql, 'orcamento_categoria', linhaValida('orcamento_categoria', a)),
    );

    await expect(
      atualizar(banco.sql, 'orcamento_categoria', id, { familia_id: b.familiaId }),
    ).rejects.toMatchObject({
      code: '23503',
      constraint_name: 'orcamento_categoria_categoria_familia_fk',
    });
  });

  it.each(COLUNAS_ANULAVEIS)('aceita NULL em %s.%s', async (tabela, coluna) => {
    const linha = { ...linhaValida(tabela, a), [coluna]: null };

    await expect(idInserido(inserir(banco.sql, tabela, linha))).resolves.toEqual(
      expect.any(String),
    );
  });

  it('mantém uma única FK por coluna referenciada (FKs simples removidas)', async () => {
    const fks = await banco.sql<{ tabela: string; coluna: string; constraint: string }[]>`
      SELECT c.conrelid::regclass::text AS tabela, a.attname AS coluna, c.conname AS constraint
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.conrelid::regclass::text IN
          ('transacoes', 'orcamento_categoria', 'templates_transacao', 'movimentacoes_cofrinho')
        AND a.attname <> 'familia_id' AND a.attname NOT LIKE '%usuario%'
        AND a.attname NOT IN ('criado_por', 'registrado_por')
      ORDER BY 1, 2`;

    expect(fks.map((fk) => fk.constraint).sort()).toEqual(
      FKS_COMPOSTAS.map((fk) => fk.constraint).sort(),
    );
  });

  it('ao excluir a transação pai, desvincula as filhas (SET NULL só em transacao_pai_id)', async () => {
    const paiId = await idInserido(inserir(banco.sql, 'transacoes', linhaValida('transacoes', a)));
    const filhaId = await idInserido(inserirTransacaoFilha(banco.sql, a, paiId));

    await banco.sql`DELETE FROM transacoes WHERE id = ${paiId}`;

    const [filha] = await banco.sql`
      SELECT transacao_pai_id, familia_id FROM transacoes WHERE id = ${filhaId}`;
    expect(filha).toEqual({ transacao_pai_id: null, familia_id: a.familiaId });
  });

  it('mantém NO ACTION: não exclui transação com movimentação de cofrinho', async () => {
    const delecao = banco.sql`DELETE FROM transacoes WHERE id = ${a.transacaoId}`;

    await expect(delecao).rejects.toMatchObject({
      code: '23503',
      constraint_name: 'movimentacoes_cofrinho_transacao_familia_fk',
    });
  });

  it('mantém NO ACTION: não exclui categoria referenciada', async () => {
    const delecao = banco.sql`DELETE FROM categorias WHERE id = ${a.categoriaId}`;

    await expect(delecao).rejects.toMatchObject({ code: '23503' });
  });

  it('o erro real do Drizzle é traduzido para ReferenciaInvalidaError sem SQL', async () => {
    const db = drizzle(banco.sql);
    const erro = await db
      .insert(transacoes)
      .values({
        familiaId: a.familiaId,
        tipo: 'despesa',
        valor: '1.00',
        categoriaId: b.categoriaId,
        data: '2026-09-15',
        mesReferencia: '2026-09',
        usuarioRegistrouId: a.usuarioId,
      })
      .then(
        () => null,
        (e: unknown) => e,
      );

    const traduzido = traduzirViolacaoReferencia(erro);
    expect(traduzido).toBeInstanceOf(ReferenciaInvalidaError);
    expect(traduzido).toMatchObject({ entidade: 'categoria' });
    expect((traduzido as Error).message).not.toContain(b.categoriaId);
  });

  it('o erro real de DELETE ainda referenciado não vira REFERENCIA_INVALIDA', async () => {
    const db = drizzle(banco.sql);
    const erro = await db
      .delete(transacoes)
      .where(eq(transacoes.id, a.transacaoId))
      .then(
        () => null,
        (e: unknown) => e,
      );

    expect(erro).not.toBeNull();
    expect(traduzirViolacaoReferencia(erro)).toBe(erro);
  });
});

describe(`migration ${MIGRATION_FK_COMPOSTAS} sobre dados legados`, () => {
  let banco: BancoDescartavel;

  beforeEach(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION_FK_COMPOSTAS);
  });

  afterEach(() => banco?.descartar());

  async function contagens() {
    const [row] = await banco.sql`
      SELECT (SELECT count(*) FROM transacoes)::int AS transacoes,
             (SELECT count(*) FROM movimentacoes_cofrinho)::int AS movimentacoes,
             (SELECT count(*) FROM templates_transacao)::int AS templates,
             (SELECT count(*) FROM drizzle.__drizzle_migrations)::int AS migrations`;
    return row;
  }

  async function constraintsCompostas(): Promise<number> {
    const [row] = await banco.sql`
      SELECT count(*)::int AS total FROM pg_constraint
      WHERE conname = ANY(${FKS_COMPOSTAS.map((fk) => fk.constraint)})`;
    return row.total as number;
  }

  /** Mensagem do PostgreSQL (causa do `DrizzleQueryError`), sem o SQL da migration. */
  async function mensagemDaFalha(): Promise<string> {
    const erro = await aplicarMigrations(banco.url).then(
      () => null,
      (e: Error) => e,
    );
    if (!erro) throw new Error('Migration aplicou, mas era esperado que falhasse');
    return ((erro.cause as Error | undefined) ?? erro).message;
  }

  async function semearLegadoValido() {
    const a = await semearFamilia(banco.sql, 'Ana');
    await semearFamilia(banco.sql, 'Bruno');
    for (const tabela of [
      'orcamento_categoria',
      'templates_transacao',
      'movimentacoes_cofrinho',
    ] as const) {
      await inserir(banco.sql, tabela, linhaValida(tabela, a));
    }
    await inserirTransacaoFilha(banco.sql, a, a.transacaoId);
    return a;
  }

  it('aplica sobre dados válidos pré-existentes sem alterar linhas e é repetível', async () => {
    await semearLegadoValido();
    const antes = await contagens();

    await aplicarMigrations(banco.url);
    await aplicarMigrations(banco.url);

    expect(await contagens()).toEqual({ ...antes, migrations: antes.migrations + 1 });
    expect(await constraintsCompostas()).toBe(FKS_COMPOSTAS.length);
  });

  it('falha de forma clara, sem apagar nada, com referência cross-tenant pré-existente', async () => {
    const a = await semearLegadoValido();
    const b = await semearFamilia(banco.sql, 'Carla');
    await inserir(banco.sql, 'transacoes', {
      ...linhaValida('transacoes', a),
      categoria_id: b.categoriaId,
    });
    const antes = await contagens();

    expect(await mensagemDaFalha()).toMatch(
      /abortada, nada foi alterado.*transacoes\.categoria_id=1.*ownership-referencias\.sql/s,
    );

    expect(await contagens()).toEqual(antes);
    expect(await constraintsCompostas()).toBe(0);
  });

  it('falha de forma clara com cofrinho órfão (coluna que não tinha FK)', async () => {
    const a = await semearLegadoValido();
    await inserir(banco.sql, 'transacoes', {
      ...linhaValida('transacoes', a),
      cofrinho_id: randomUUID(),
    });

    expect(await mensagemDaFalha()).toMatch(/transacoes\.cofrinho_id=1/);
    expect(await constraintsCompostas()).toBe(0);
  });

  it('desvincula filhas cujo pai foi apagado (órfãs de transacao_pai_id) e aplica', async () => {
    const a = await semearLegadoValido();
    const paiId = await idInserido(inserir(banco.sql, 'transacoes', linhaValida('transacoes', a)));
    const filhaId = await idInserido(inserirTransacaoFilha(banco.sql, a, paiId));
    await banco.sql`DELETE FROM transacoes WHERE id = ${paiId}`;
    const antes = await contagens();

    await aplicarMigrations(banco.url);

    const [filha] = await banco.sql`
      SELECT transacao_pai_id, familia_id FROM transacoes WHERE id = ${filhaId}`;
    expect(filha).toEqual({ transacao_pai_id: null, familia_id: a.familiaId });
    expect(await contagens()).toEqual({ ...antes, migrations: antes.migrations + 1 });
    expect(await constraintsCompostas()).toBe(FKS_COMPOSTAS.length);
  });

  it('pai de outra família continua abortando sem alterar o vínculo', async () => {
    const a = await semearLegadoValido();
    const b = await semearFamilia(banco.sql, 'Carla');
    const filhaId = await idInserido(inserirTransacaoFilha(banco.sql, a, b.transacaoId));

    expect(await mensagemDaFalha()).toMatch(/transacoes\.transacao_pai_id=1/);
    const [filha] = await banco.sql`SELECT transacao_pai_id FROM transacoes WHERE id = ${filhaId}`;
    expect(filha).toEqual({ transacao_pai_id: b.transacaoId });
    expect(await constraintsCompostas()).toBe(0);
  });

  it('falha rápido por lock_timeout em vez de esperar um lock concorrente', async () => {
    await semearLegadoValido();
    const concorrente = conectar(banco.url);
    let liberarLock = () => {};
    const segurandoLock = concorrente.begin(async (tx) => {
      // tx.unsafe: o tipo TransactionSql do postgres.js não expõe a chamada como tagged template.
      await tx.unsafe('LOCK TABLE categorias IN ACCESS EXCLUSIVE MODE');
      await new Promise<void>((resolve) => (liberarLock = resolve));
    });
    await expect
      .poll(
        async () =>
          (
            await banco.sql`
      SELECT count(*)::int AS n FROM pg_locks l JOIN pg_class c ON c.oid = l.relation
      WHERE c.relname = 'categorias' AND l.mode = 'AccessExclusiveLock' AND l.granted`
          )[0].n,
      )
      .toBe(1);

    const inicio = Date.now();
    const erro = await aplicarMigrations(banco.url).then(
      () => null,
      (e: Error) => (e.cause as { code?: string } | undefined) ?? e,
    );
    const duracaoMs = Date.now() - inicio;
    liberarLock();
    await segurandoLock;
    await concorrente.end();

    expect(erro).toMatchObject({ code: '55P03' });
    expect(duracaoMs).toBeLessThan(15_000);
    expect(await constraintsCompostas()).toBe(0);
  });
});
