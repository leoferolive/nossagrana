import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { DrizzleHistoricoRepository } from '../../modules/historico/historico.repository.js';
import type { SnapshotInsertInput } from '../../modules/historico/historico.types.js';
import {
  aplicarMigrations,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

// O repository importa o `db` global (exige DATABASE_URL da app); aqui o
// executor real é injetado no construtor, então o módulo é neutralizado.
vi.mock('../client.js', () => ({ db: undefined }));

// Issue #69: unicidade (familia_id, mes_referencia) + insert idempotente.
const MES = '2026-09';

function entrada(familiaId: string, totalReceitas = '100.00'): SnapshotInsertInput {
  return {
    familiaId,
    mesReferencia: MES,
    totalReceitas,
    totalDespesas: '40.00',
    saldo: '60.00',
    dadosCategorias: [],
    dadosUsuarios: [],
  };
}

async function criarFamilia(sql: postgres.Sql, nome: string): Promise<string> {
  const [row] = await sql`INSERT INTO familias (nome) VALUES (${nome}) RETURNING id`;
  return row!.id as string;
}

async function contarSnapshots(sql: postgres.Sql, familiaId: string): Promise<number> {
  const [row] = await sql`SELECT count(*)::int AS n FROM snapshots_mensais
    WHERE familia_id = ${familiaId} AND mes_referencia = ${MES}`;
  return row!.n as number;
}

describe('snapshots_mensais único por família e mês (pg)', () => {
  let banco: BancoDescartavel;
  let conexaoB: postgres.Sql;
  let repoA: DrizzleHistoricoRepository;
  let repoB: DrizzleHistoricoRepository;

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    conexaoB = conectar(banco.url);
    repoA = new DrizzleHistoricoRepository(drizzle(banco.sql));
    repoB = new DrizzleHistoricoRepository(drizzle(conexaoB));
  });

  afterAll(async () => {
    await conexaoB.end();
    await banco.descartar();
  });

  it('duas criações concorrentes (duas conexões) deixam uma única linha', async () => {
    const familiaId = await criarFamilia(banco.sql, 'Concorrente');

    const [a, b] = await Promise.all([
      repoA.insertSnapshot(entrada(familiaId, '100.00')),
      repoB.insertSnapshot(entrada(familiaId, '999.00')),
    ]);

    expect(await contarSnapshots(banco.sql, familiaId)).toBe(1);
    expect([a.criado, b.criado].sort()).toEqual([false, true]);
    expect(a.snapshot.id).toBe(b.snapshot.id);
  });

  it('reprocessar devolve o existente sem alterar nenhum campo', async () => {
    const familiaId = await criarFamilia(banco.sql, 'Reprocesso');
    const original = await repoA.insertSnapshot(entrada(familiaId, '100.00'));
    await repoA.marcarDivergente(familiaId, MES);

    const repetido = await repoA.insertSnapshot(entrada(familiaId, '777.00'));

    expect(repetido.criado).toBe(false);
    expect(repetido.snapshot.id).toBe(original.snapshot.id);
    expect(repetido.snapshot.totalReceitas).toBe('100.00');
    expect(repetido.snapshot.divergente).toBe(true);
    expect(repetido.snapshot.geradoEm).toEqual(original.snapshot.geradoEm);
  });

  it('o mesmo mês em famílias diferentes coexiste', async () => {
    const familiaA = await criarFamilia(banco.sql, 'Familia A');
    const familiaB = await criarFamilia(banco.sql, 'Familia B');

    const a = await repoA.insertSnapshot(entrada(familiaA));
    const b = await repoA.insertSnapshot(entrada(familiaB));

    expect([a.criado, b.criado]).toEqual([true, true]);
    expect(a.snapshot.id).not.toBe(b.snapshot.id);
    expect((await repoA.findSnapshot(familiaB, MES))?.id).toBe(b.snapshot.id);
  });

  it('o banco rejeita INSERT direto duplicado (índice único)', async () => {
    const familiaId = await criarFamilia(banco.sql, 'Direto');
    await repoA.insertSnapshot(entrada(familiaId));

    await expect(
      banco.sql`INSERT INTO snapshots_mensais (familia_id, mes_referencia, total_receitas,
        total_despesas, saldo, dados_categorias, dados_usuarios)
        VALUES (${familiaId}, ${MES}, 1, 1, 0, '[]', '[]')`,
    ).rejects.toMatchObject({ code: '23505' });
  });
});
