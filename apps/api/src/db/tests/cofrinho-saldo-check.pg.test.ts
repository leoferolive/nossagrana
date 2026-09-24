import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { semearFamilia, type FamiliaSemeada } from './pg-fixtures.js';
import {
  aplicarMigrations,
  aplicarMigrationsAntesDe,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Migration 0010 (#62): `CHECK (saldo_atual >= 0)` em `cofrinhos`, com
 * pré-checagem que aborta sem alterar nada se já houver saldo negativo.
 */
const MIGRATION_SALDO_CHECK = '0010_cofrinho_saldo_nao_negativo';
const CONSTRAINT = 'cofrinhos_saldo_atual_nao_negativo';

describe(`migration ${MIGRATION_SALDO_CHECK} sobre dados legados`, () => {
  let banco: BancoDescartavel;
  let familia: FamiliaSemeada;

  beforeEach(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION_SALDO_CHECK);
    familia = await semearFamilia(banco.sql, 'Ana');
  });

  afterEach(() => banco?.descartar());

  async function constraintExiste(): Promise<boolean> {
    const [linha] =
      await banco.sql`SELECT count(*)::int AS n FROM pg_constraint WHERE conname = ${CONSTRAINT}`;
    return linha?.n === 1;
  }

  async function saldos(): Promise<string[]> {
    const linhas =
      await banco.sql`SELECT saldo_atual::text AS saldo FROM cofrinhos ORDER BY saldo_atual`;
    return linhas.map((l) => l.saldo as string);
  }

  it('aplica sobre saldos válidos (inclusive zero) sem alterar linhas e é repetível', async () => {
    await banco.sql`UPDATE cofrinhos SET saldo_atual = 12.34 WHERE id = ${familia.cofrinhoId}`;
    await banco.sql`INSERT INTO cofrinhos (familia_id, nome, criado_por)
      VALUES (${familia.familiaId}, 'Zerado', ${familia.usuarioId})`;

    await aplicarMigrations(banco.url);
    await aplicarMigrations(banco.url);

    expect(await saldos()).toEqual(['0.00', '12.34']);
    expect(await constraintExiste()).toBe(true);
  });

  it('aborta de forma clara, sem alterar nada, se já existe cofrinho com saldo negativo', async () => {
    await banco.sql`UPDATE cofrinhos SET saldo_atual = -0.01 WHERE id = ${familia.cofrinhoId}`;

    const erro = await aplicarMigrations(banco.url).then(
      () => null,
      (e: Error) => (e.cause as Error | undefined) ?? e,
    );

    expect(erro?.message).toMatch(
      /abortada, nada foi alterado.*cofrinhos com saldo negativo: 1.*reconciliacao-cofrinhos\.sql/s,
    );
    expect(await saldos()).toEqual(['-0.01']);
    expect(await constraintExiste()).toBe(false);
  });

  it('falha rápido por lock_timeout se outra transação segura a tabela', async () => {
    const concorrente = conectar(banco.url);
    let liberarLock = () => {};
    let sinalizar = () => {};
    const travada = new Promise<void>((resolve) => (sinalizar = resolve));
    const segurandoLock = concorrente.begin(async (tx) => {
      // tx.unsafe: o tipo TransactionSql do postgres.js não expõe a chamada como tagged template.
      await tx.unsafe('LOCK TABLE cofrinhos IN ACCESS EXCLUSIVE MODE');
      sinalizar();
      await new Promise<void>((resolve) => (liberarLock = resolve));
    });
    await travada;

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
    expect(await constraintExiste()).toBe(false);
  });
});
