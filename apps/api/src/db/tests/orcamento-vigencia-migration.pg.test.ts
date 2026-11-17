import type postgres from 'postgres';
import { afterEach, describe, expect, it } from 'vitest';

import { inserirId, semearFamilia, type FamiliaSemeada } from './pg-fixtures.js';
import {
  aplicarMigrations,
  aplicarMigrationsAntesDe,
  criarBancoDescartavel,
  reaplicarMigration,
  type BancoDescartavel,
} from './pg-harness.js';

// Nova UI, Entrega 3 (PR 1): editar o limite na mesma vigência gravava outra
// linha. A migration remove só a duplicata exata (família + categoria + início),
// mantendo a mais recente, sem tocar em limites de outras vigências.
const MIGRATION = '0015_orcamento_vigencia_unica';

interface Limite {
  inicio: string;
  fim: string | null;
  valor: string;
  criadoEm: string;
}

function inserirLimite(sql: postgres.Sql, f: FamiliaSemeada, l: Limite): Promise<string> {
  return inserirId(
    sql`INSERT INTO orcamento_categoria (familia_id, categoria_id, valor_limite, vigencia_inicio,
          vigencia_fim, criado_por, criado_em)
        VALUES (${f.familiaId}, ${f.categoriaId}, ${l.valor}, ${l.inicio}, ${l.fim},
          ${f.usuarioId}, ${l.criadoEm}) RETURNING id`,
  );
}

async function idsDe(sql: postgres.Sql, f: FamiliaSemeada): Promise<string[]> {
  const rows = await sql`SELECT id FROM orcamento_categoria WHERE familia_id = ${f.familiaId}`;
  return rows.map((r) => r.id as string);
}

async function semearAntes(): Promise<{ banco: BancoDescartavel; f: FamiliaSemeada }> {
  const banco = await criarBancoDescartavel();
  await aplicarMigrationsAntesDe(banco.url, MIGRATION);
  return { banco, f: await semearFamilia(banco.sql, 'Legada') };
}

describe('migration 0015: um limite por vigência (pg)', () => {
  let banco: BancoDescartavel;

  afterEach(async () => {
    await banco.descartar();
  });

  it('remove a duplicata da mesma vigência e mantém a mais recente', async () => {
    const semeado = await semearAntes();
    banco = semeado.banco;
    const { f } = semeado;
    const velha = await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: '2026-11',
      valor: '500.00',
      criadoEm: '2026-11-01T10:00:00Z',
    });
    const meio = await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: '2026-11',
      valor: '600.00',
      criadoEm: '2026-11-02T10:00:00Z',
    });
    const atual = await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: null,
      valor: '700.00',
      criadoEm: '2026-11-03T10:00:00Z',
    });

    await aplicarMigrations(banco.url);

    const restantes = await idsDe(banco.sql, f);
    expect(restantes).toEqual([atual]);
    expect(restantes).not.toContain(velha);
    expect(restantes).not.toContain(meio);
  });

  it('não toca em limites de outras vigências, de outra categoria nem de outra família', async () => {
    const semeado = await semearAntes();
    banco = semeado.banco;
    const { f } = semeado;
    const vizinha = await semearFamilia(banco.sql, 'Vizinha');
    const anterior = await inserirLimite(banco.sql, f, {
      inicio: '2026-09',
      fim: '2026-10',
      valor: '400.00',
      criadoEm: '2026-09-01T10:00:00Z',
    });
    const dupDoMes = await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: '2026-11',
      valor: '500.00',
      criadoEm: '2026-11-01T10:00:00Z',
    });
    const atual = await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: null,
      valor: '700.00',
      criadoEm: '2026-11-02T10:00:00Z',
    });
    const mesmoInicioOutraFamilia = await inserirLimite(banco.sql, vizinha, {
      inicio: '2026-11',
      fim: null,
      valor: '300.00',
      criadoEm: '2026-11-03T10:00:00Z',
    });
    const outraCategoria = await inserirId(
      banco.sql`INSERT INTO categorias (familia_id, nome, tipo, criado_por)
        VALUES (${f.familiaId}, 'Lazer', 'despesa', ${f.usuarioId}) RETURNING id`,
    );
    const deOutraCategoria = await inserirId(
      banco.sql`INSERT INTO orcamento_categoria (familia_id, categoria_id, valor_limite,
          vigencia_inicio, criado_por, criado_em)
        VALUES (${f.familiaId}, ${outraCategoria}, '200.00', '2026-11', ${f.usuarioId},
          '2026-11-04T10:00:00Z') RETURNING id`,
    );

    await aplicarMigrations(banco.url);

    const daFamilia = await idsDe(banco.sql, f);
    expect(daFamilia.sort()).toEqual([anterior, atual, deOutraCategoria].sort());
    expect(daFamilia).not.toContain(dupDoMes);
    expect(await idsDe(banco.sql, vizinha)).toEqual([mesmoInicioOutraFamilia]);
    const [preservado] = await banco.sql`
      SELECT vigencia_fim, valor_limite FROM orcamento_categoria WHERE id = ${anterior}`;
    expect(preservado).toMatchObject({ vigencia_fim: '2026-10', valor_limite: '400.00' });
  });

  it('rodar de novo não muda nada', async () => {
    const semeado = await semearAntes();
    banco = semeado.banco;
    const { f } = semeado;
    await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: '2026-11',
      valor: '500.00',
      criadoEm: '2026-11-01T10:00:00Z',
    });
    const atual = await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: null,
      valor: '700.00',
      criadoEm: '2026-11-02T10:00:00Z',
    });
    await aplicarMigrations(banco.url);

    await reaplicarMigration(banco.sql, MIGRATION);

    expect(await idsDe(banco.sql, f)).toEqual([atual]);
  });
});
