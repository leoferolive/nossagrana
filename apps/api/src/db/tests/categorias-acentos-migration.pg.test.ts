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

// Nova UI, Entrega 1: as categorias padrão eram gravadas sem acento. A
// migration renomeia as que ainda têm exatamente o nome antigo.
const MIGRATION = '0014_categorias_padrao_acentos';

function inserirCategoria(
  sql: postgres.Sql,
  f: FamiliaSemeada,
  nome: string,
  tipo: 'receita' | 'despesa',
): Promise<string> {
  return inserirId(
    sql`INSERT INTO categorias (familia_id, nome, tipo, criado_por)
        VALUES (${f.familiaId}, ${nome}, ${tipo}, ${f.usuarioId}) RETURNING id`,
  );
}

async function nomeDe(sql: postgres.Sql, id: string): Promise<string> {
  const [row] = await sql`SELECT nome FROM categorias WHERE id = ${id}`;
  return row!.nome as string;
}

describe('migration 0014: acentos nas categorias padrão (pg)', () => {
  let banco: BancoDescartavel;

  afterEach(async () => {
    await banco.descartar();
  });

  it('renomeia as cinco categorias padrão e não toca nas demais', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const f = await semearFamilia(banco.sql, 'Legada');
    const ids = {
      alimentacao: await inserirCategoria(banco.sql, f, 'Alimentacao', 'despesa'),
      saude: await inserirCategoria(banco.sql, f, 'Saude', 'despesa'),
      educacao: await inserirCategoria(banco.sql, f, 'Educacao', 'despesa'),
      salario: await inserirCategoria(banco.sql, f, 'Salario', 'receita'),
      bonus: await inserirCategoria(banco.sql, f, 'Bonus', 'receita'),
      moradia: await inserirCategoria(banco.sql, f, 'Moradia', 'despesa'),
      saudeReceita: await inserirCategoria(banco.sql, f, 'Saude', 'receita'),
    };

    await aplicarMigrations(banco.url);

    expect(await nomeDe(banco.sql, ids.alimentacao)).toBe('Alimentação');
    expect(await nomeDe(banco.sql, ids.saude)).toBe('Saúde');
    expect(await nomeDe(banco.sql, ids.educacao)).toBe('Educação');
    expect(await nomeDe(banco.sql, ids.salario)).toBe('Salário');
    expect(await nomeDe(banco.sql, ids.bonus)).toBe('Bônus');
    expect(await nomeDe(banco.sql, ids.moradia)).toBe('Moradia');
    // "Saude" só é categoria padrão de despesa; a de receita foi criada pela família.
    expect(await nomeDe(banco.sql, ids.saudeReceita)).toBe('Saude');
    expect(await nomeDe(banco.sql, f.categoriaId)).toBe('Mercado');
  });

  it('não renomeia quando a família já tem a categoria com acento', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const f = await semearFamilia(banco.sql, 'ComAcento');
    const vizinha = await semearFamilia(banco.sql, 'Vizinha');
    const semAcento = await inserirCategoria(banco.sql, f, 'Saude', 'despesa');
    const comAcento = await inserirCategoria(banco.sql, f, 'Saúde', 'despesa');
    const daVizinha = await inserirCategoria(banco.sql, vizinha, 'Saude', 'despesa');

    await aplicarMigrations(banco.url);

    expect(await nomeDe(banco.sql, semAcento)).toBe('Saude');
    expect(await nomeDe(banco.sql, comAcento)).toBe('Saúde');
    // A categoria com acento de uma família não impede a correção na outra.
    expect(await nomeDe(banco.sql, daVizinha)).toBe('Saúde');
  });

  it('rodar de novo não muda nenhum nome', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const f = await semearFamilia(banco.sql, 'Legada');
    const saude = await inserirCategoria(banco.sql, f, 'Saude', 'despesa');
    await aplicarMigrations(banco.url);
    const criadaDepois = await inserirCategoria(banco.sql, f, 'Saude', 'despesa');

    await reaplicarMigration(banco.sql, MIGRATION);

    expect(await nomeDe(banco.sql, saude)).toBe('Saúde');
    expect(await nomeDe(banco.sql, criadaDepois)).toBe('Saude');
  });
});
