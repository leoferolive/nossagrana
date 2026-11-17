import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterEach, describe, expect, it } from 'vitest';

import { LimiteVigenciaDuplicadaError } from '../../modules/orcamento/orcamento.errors.js';
import { DrizzleOrcamentoRepository } from '../../modules/orcamento/orcamento.repository.js';
import { inserirId, semearFamilia, type FamiliaSemeada } from './pg-fixtures.js';
import {
  aplicarMigrations,
  aplicarMigrationsAntesDe,
  criarBancoDescartavel,
  reaplicarMigration,
  type BancoDescartavel,
} from './pg-harness.js';

// Nova UI, Entrega 3 (PR 1): editar o limite na mesma vigência gravava outra
// linha. A migration MOVE só a duplicata exata (família + categoria + início) para
// "orcamento_categoria_duplicados", mantendo a mais recente, e cria o índice único
// que impede a duplicata de voltar. Limites de outras vigências não são tocados.
const MIGRATION = '0015_orcamento_vigencia_unica';
const INDICE = 'orcamento_categoria_vigencia_uq';

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

async function existeIndiceUnico(sql: postgres.Sql): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM pg_indexes
    WHERE tablename = 'orcamento_categoria' AND indexname = ${INDICE}
      AND indexdef LIKE 'CREATE UNIQUE INDEX%'`;
  return rows.length === 1;
}

async function idsMovidos(sql: postgres.Sql): Promise<string[]> {
  const rows = await sql`SELECT id FROM orcamento_categoria_duplicados ORDER BY criado_em`;
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

  it('aplica em banco limpo e cria a tabela de auditoria e o índice único', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);

    expect(await existeIndiceUnico(banco.sql)).toBe(true);
    const [tabela] = await banco.sql`SELECT to_regclass('orcamento_categoria_duplicados') AS t`;
    expect(tabela!.t).not.toBeNull();
  });

  it('o índice impede inserir outro limite da mesma família, categoria e vigência', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const f = await semearFamilia(banco.sql, 'Nova');
    await aplicarMigrations(banco.url);
    await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: null,
      valor: '500.00',
      criadoEm: '2026-11-01T10:00:00Z',
    });

    const erro = await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: null,
      valor: '600.00',
      criadoEm: '2026-11-02T10:00:00Z',
    }).then(
      () => null,
      (e: { code?: string; constraint_name?: string }) => e,
    );

    expect(erro).toMatchObject({ code: '23505', constraint_name: INDICE });
  });

  it('mantém a mais recente da mesma vigência e move as demais com os valores intactos', async () => {
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

    expect(await idsDe(banco.sql, f)).toEqual([atual]);
    expect(await idsMovidos(banco.sql)).toEqual([velha, meio]);
    const [movido] = await banco.sql`SELECT * FROM orcamento_categoria_duplicados
      WHERE id = ${velha}`;
    expect(movido).toMatchObject({
      familia_id: f.familiaId,
      categoria_id: f.categoriaId,
      valor_limite: '500.00',
      vigencia_inicio: '2026-11',
      vigencia_fim: '2026-11',
      criado_por: f.usuarioId,
    });
    expect(movido!.criado_em).toEqual(new Date('2026-11-01T10:00:00Z'));
    expect(movido!.movido_em).toBeInstanceOf(Date);
    expect(await existeIndiceUnico(banco.sql)).toBe(true);
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
    expect(await idsMovidos(banco.sql)).toEqual([dupDoMes]);
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
    expect((await idsMovidos(banco.sql)).length).toBe(1);
    expect(await existeIndiceUnico(banco.sql)).toBe(true);
  });
});

describe('DrizzleOrcamentoRepository.substituirVigente no PostgreSQL', () => {
  let banco: BancoDescartavel;

  afterEach(async () => {
    await banco.descartar();
  });

  async function limiteAberto(sql: postgres.Sql, id: string) {
    const [row] = await sql`SELECT vigencia_fim FROM orcamento_categoria WHERE id = ${id}`;
    return row!.vigencia_fim as string | null;
  }

  it('se a inserção viola o índice, o limite aberto não fica encerrado (rollback)', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    const f = await semearFamilia(banco.sql, 'Atomica');
    const aberto = await inserirLimite(banco.sql, f, {
      inicio: '2026-10',
      fim: null,
      valor: '500.00',
      criadoEm: '2026-10-01T10:00:00Z',
    });
    await inserirLimite(banco.sql, f, {
      inicio: '2026-11',
      fim: '2026-11',
      valor: '300.00',
      criadoEm: '2026-11-01T10:00:00Z',
    });
    const repo = new DrizzleOrcamentoRepository(drizzle(banco.sql));

    await expect(
      repo.substituirVigente(aberto, '2026-10', {
        familiaId: f.familiaId,
        categoriaId: f.categoriaId,
        usuarioId: f.usuarioId,
        valorLimite: '900.00',
        vigenciaInicio: '2026-11',
      }),
    ).rejects.toBeInstanceOf(LimiteVigenciaDuplicadaError);

    expect(await limiteAberto(banco.sql, aberto)).toBeNull();
  });

  it('com a vigência livre, encerra o vigente e insere o novo na mesma transação', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    const f = await semearFamilia(banco.sql, 'Troca');
    const aberto = await inserirLimite(banco.sql, f, {
      inicio: '2026-10',
      fim: null,
      valor: '500.00',
      criadoEm: '2026-10-01T10:00:00Z',
    });
    const repo = new DrizzleOrcamentoRepository(drizzle(banco.sql));

    await repo.substituirVigente(aberto, '2026-10', {
      familiaId: f.familiaId,
      categoriaId: f.categoriaId,
      usuarioId: f.usuarioId,
      valorLimite: '900.00',
      vigenciaInicio: '2026-11',
    });

    expect(await limiteAberto(banco.sql, aberto)).toBe('2026-10');
    expect((await idsDe(banco.sql, f)).length).toBe(2);
  });
});
