import type postgres from 'postgres';
import { afterEach, describe, expect, it } from 'vitest';

import {
  aplicarMigrations,
  conectar,
  aplicarMigrationsAntesDe,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

// Issue #69: a migration deduplica sem perder dados e depois cria o índice único.
const MIGRATION = '0012_snapshot_unico';
const INDICE = 'snapshots_mensais_familia_mes_uq';

async function criarFamilia(sql: postgres.Sql, nome: string): Promise<string> {
  const [row] = await sql`INSERT INTO familias (nome) VALUES (${nome}) RETURNING id`;
  return row!.id as string;
}

async function inserirSnapshot(
  sql: postgres.Sql,
  familiaId: string,
  mes: string,
  receitas: string,
  geradoEm: string,
): Promise<string> {
  const [row] = await sql`INSERT INTO snapshots_mensais (familia_id, mes_referencia,
      total_receitas, total_despesas, saldo, dados_categorias, dados_usuarios, gerado_em)
    VALUES (${familiaId}, ${mes}, ${receitas}, 0, ${receitas}, '[]', '[]', ${geradoEm})
    RETURNING id`;
  return row!.id as string;
}

async function existeIndiceUnico(sql: postgres.Sql): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM pg_indexes
    WHERE tablename = 'snapshots_mensais' AND indexname = ${INDICE}
      AND indexdef LIKE 'CREATE UNIQUE INDEX%'`;
  return rows.length === 1;
}

describe('migration 0012: snapshot único por família e mês (pg)', () => {
  let banco: BancoDescartavel;

  afterEach(async () => {
    await banco.descartar();
  });

  it('aplica em banco limpo e cria o índice único e a tabela de auditoria', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);

    expect(await existeIndiceUnico(banco.sql)).toBe(true);
    const [tabela] = await banco.sql`SELECT to_regclass('snapshots_mensais_duplicados') AS t`;
    expect(tabela!.t).not.toBeNull();
  });

  it('com duplicatas legadas: mantém a mais antiga e move as demais para a auditoria', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const familiaId = await criarFamilia(banco.sql, 'Legada');
    const outra = await criarFamilia(banco.sql, 'Sem duplicata');
    const recente = await inserirSnapshot(
      banco.sql,
      familiaId,
      '2026-08',
      '300',
      '2026-09-02T00:00:00Z',
    );
    const antigo = await inserirSnapshot(
      banco.sql,
      familiaId,
      '2026-08',
      '100',
      '2026-09-01T00:00:00Z',
    );
    const meio = await inserirSnapshot(
      banco.sql,
      familiaId,
      '2026-08',
      '200',
      '2026-09-01T12:00:00Z',
    );
    const unico = await inserirSnapshot(banco.sql, outra, '2026-08', '50', '2026-09-01T00:00:00Z');

    await aplicarMigrations(banco.url);

    const mantidos = await banco.sql`SELECT id FROM snapshots_mensais ORDER BY id`;
    expect(mantidos.map((r) => r.id).sort()).toEqual([antigo, unico].sort());
    const movidos = await banco.sql`SELECT id, total_receitas, movido_em
      FROM snapshots_mensais_duplicados ORDER BY gerado_em`;
    expect(movidos.map((r) => r.id)).toEqual([meio, recente]);
    expect(movidos[0]!.total_receitas).toBe('200.00');
    expect(movidos[0]!.movido_em).toBeInstanceOf(Date);
    expect(await existeIndiceUnico(banco.sql)).toBe(true);
  });

  it('empate em gerado_em: o menor id é o canônico', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const familiaId = await criarFamilia(banco.sql, 'Empate');
    const ids = [
      await inserirSnapshot(banco.sql, familiaId, '2026-08', '1', '2026-09-01T00:00:00Z'),
      await inserirSnapshot(banco.sql, familiaId, '2026-08', '2', '2026-09-01T00:00:00Z'),
    ].sort();

    await aplicarMigrations(banco.url);

    const [mantido] = await banco.sql`SELECT id FROM snapshots_mensais`;
    const [movido] = await banco.sql`SELECT id FROM snapshots_mensais_duplicados`;
    expect(mantido!.id).toBe(ids[0]);
    expect(movido!.id).toBe(ids[1]);
  });

  it('falha rápido por lock_timeout (55P03) com rollback total se outra sessão lê a tabela', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const concorrente = conectar(banco.url);
    let liberarLock = () => {};
    let sinalizar = () => {};
    const travada = new Promise<void>((resolve) => (sinalizar = resolve));
    const segurandoLock = concorrente.begin(async (tx) => {
      // Imita o pg_dump do backup: ACCESS SHARE conflita com o ACCESS EXCLUSIVE do DROP INDEX.
      await tx.unsafe('LOCK TABLE snapshots_mensais IN ACCESS SHARE MODE');
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
    const [auditoria] = await banco.sql`SELECT to_regclass('snapshots_mensais_duplicados') AS t`;
    expect(auditoria!.t).toBeNull();
    expect(await existeIndiceUnico(banco.sql)).toBe(false);
    const [antigo] = await banco.sql`SELECT count(*)::int AS n FROM pg_indexes
      WHERE indexname = 'snapshots_mensais_familia_mes_idx'`;
    expect(antigo!.n).toBe(1);
  });
});
