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

// Nova UI, Entrega 1: o pai de um parcelamento era gravado com o valor total da
// compra. A migration troca pelo valor da parcela e marca como divergente o
// snapshot do mês afetado.
const MIGRATION = '0013_parcela_pai_valor';
const TOTAL = '1299.90';
const PARCELA = '129.99';

interface Parcela {
  valor: string;
  mes: string;
  parcelaAtual: number;
  paiId?: string;
}

function inserirParcela(sql: postgres.Sql, f: FamiliaSemeada, p: Parcela): Promise<string> {
  return inserirId(
    sql`INSERT INTO transacoes (familia_id, tipo, valor, categoria_id, data, mes_referencia,
          usuario_registrou_id, parcelado, numero_parcelas, parcela_atual, valor_total,
          valor_parcela, transacao_pai_id)
        VALUES (${f.familiaId}, 'despesa', ${p.valor}, ${f.categoriaId}, ${`${p.mes}-10`}, ${p.mes},
          ${f.usuarioId}, true, 10, ${p.parcelaAtual}, ${TOTAL}, ${PARCELA}, ${p.paiId ?? null})
        RETURNING id`,
  );
}

function inserirSnapshot(sql: postgres.Sql, familiaId: string, mes: string): Promise<string> {
  return inserirId(
    sql`INSERT INTO snapshots_mensais (familia_id, mes_referencia, total_receitas,
          total_despesas, saldo, dados_categorias, dados_usuarios)
        VALUES (${familiaId}, ${mes}, 0, ${TOTAL}, 0, '[]', '[]') RETURNING id`,
  );
}

async function valorDe(sql: postgres.Sql, id: string): Promise<string> {
  const [row] = await sql`SELECT valor FROM transacoes WHERE id = ${id}`;
  return row!.valor as string;
}

async function divergente(sql: postgres.Sql, id: string): Promise<boolean> {
  const [row] = await sql`SELECT divergente FROM snapshots_mensais WHERE id = ${id}`;
  return row!.divergente as boolean;
}

describe('migration 0013: pai de parcelamento vale a parcela (pg)', () => {
  let banco: BancoDescartavel;

  afterEach(async () => {
    await banco.descartar();
  });

  it('corrige o pai legado e não toca em filha, pai já editado nem transação não parcelada', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const f = await semearFamilia(banco.sql, 'Legada');
    const pai = await inserirParcela(banco.sql, f, {
      valor: TOTAL,
      mes: '2026-08',
      parcelaAtual: 1,
    });
    const filha = await inserirParcela(banco.sql, f, {
      valor: PARCELA,
      mes: '2026-09',
      parcelaAtual: 2,
      paiId: pai,
    });
    const editado = await inserirParcela(banco.sql, f, {
      valor: '500.00',
      mes: '2026-08',
      parcelaAtual: 1,
    });

    await aplicarMigrations(banco.url);

    expect(await valorDe(banco.sql, pai)).toBe(PARCELA);
    expect(await valorDe(banco.sql, filha)).toBe(PARCELA);
    expect(await valorDe(banco.sql, editado)).toBe('500.00');
    expect(await valorDe(banco.sql, f.transacaoId)).toBe('10.00');
    const [total] = await banco.sql`SELECT valor_total FROM transacoes WHERE id = ${pai}`;
    expect(total!.valor_total).toBe(TOTAL);
  });

  it('marca como divergente só o snapshot da família e do mês do pai corrigido', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const f = await semearFamilia(banco.sql, 'Legada');
    const vizinha = await semearFamilia(banco.sql, 'Vizinha');
    await inserirParcela(banco.sql, f, { valor: TOTAL, mes: '2026-08', parcelaAtual: 1 });
    const doMes = await inserirSnapshot(banco.sql, f.familiaId, '2026-08');
    const outroMes = await inserirSnapshot(banco.sql, f.familiaId, '2026-07');
    const daVizinha = await inserirSnapshot(banco.sql, vizinha.familiaId, '2026-08');

    await aplicarMigrations(banco.url);

    expect(await divergente(banco.sql, doMes)).toBe(true);
    expect(await divergente(banco.sql, outroMes)).toBe(false);
    expect(await divergente(banco.sql, daVizinha)).toBe(false);
  });

  it('rodar de novo não muda nenhum valor', async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrationsAntesDe(banco.url, MIGRATION);
    const f = await semearFamilia(banco.sql, 'Legada');
    const pai = await inserirParcela(banco.sql, f, {
      valor: TOTAL,
      mes: '2026-08',
      parcelaAtual: 1,
    });
    await aplicarMigrations(banco.url);
    const snapshotNovo = await inserirSnapshot(banco.sql, f.familiaId, '2026-08');

    await reaplicarMigration(banco.sql, MIGRATION);

    expect(await valorDe(banco.sql, pai)).toBe(PARCELA);
    expect(await divergente(banco.sql, snapshotNovo)).toBe(false);
  });
});
