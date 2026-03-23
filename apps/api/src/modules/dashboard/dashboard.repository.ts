import { and, eq, gte, lte, or, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, orcamentoCategoria, snapshotsMensais, transacoes } from '../../db/schema.js';
import type {
  CategoriaGasto,
  DashboardRepository,
  DiaGasto,
  GastoCategoria,
  OrcamentoVigente,
  ResumoMes,
  SnapshotMes,
} from './dashboard.types.js';

// ─── InMemory ─────────────────────────────────────────────────────────────────

interface SeedTransacao {
  familiaId: string;
  mesReferencia: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  data: string;
  categoriaId: string;
  categoriaNome?: string;
  categoriaSistema?: boolean;
}

interface SeedSnapshot {
  familiaId: string;
  mesReferencia: string;
  totalReceitas: string;
  totalDespesas: string;
  saldo: string;
}

interface SeedOrcamento {
  familiaId: string;
  categoriaId: string;
  categoriaNome: string;
  valorLimite: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

interface SeedData {
  transacoes?: SeedTransacao[];
  snapshots?: SeedSnapshot[];
  orcamentos?: SeedOrcamento[];
}

export class InMemoryDashboardRepository implements DashboardRepository {
  private _transacoes: SeedTransacao[] = [];
  private _snapshots: SeedSnapshot[] = [];
  private _orcamentos: SeedOrcamento[] = [];

  seed(data: SeedData) {
    if (data.transacoes) this._transacoes.push(...data.transacoes);
    if (data.snapshots) this._snapshots.push(...data.snapshots);
    if (data.orcamentos) this._orcamentos.push(...data.orcamentos);
  }

  async getResumoMes(familiaId: string, mesReferencia: string): Promise<ResumoMes> {
    const ts = this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia,
    );
    let totalReceitas = 0;
    let totalDespesas = 0;
    for (const t of ts) {
      if (t.tipo === 'receita') totalReceitas += parseFloat(t.valor);
      else totalDespesas += parseFloat(t.valor);
    }
    const saldo = totalReceitas - totalDespesas;
    return {
      totalReceitas: totalReceitas.toFixed(2),
      totalDespesas: totalDespesas.toFixed(2),
      saldo: saldo.toFixed(2),
    };
  }

  async getSnapshotMes(familiaId: string, mesReferencia: string): Promise<SnapshotMes | null> {
    const s = this._snapshots.find(
      (s) => s.familiaId === familiaId && s.mesReferencia === mesReferencia,
    );
    return s ?? null;
  }

  async getDistribuicaoCategorias(
    familiaId: string,
    mesReferencia: string,
  ): Promise<CategoriaGasto[]> {
    const despesas = this._transacoes.filter(
      (t) =>
        t.familiaId === familiaId &&
        t.mesReferencia === mesReferencia &&
        t.tipo === 'despesa' &&
        !t.categoriaSistema,
    );
    const map = new Map<string, { nome: string; total: number }>();
    for (const t of despesas) {
      const existing = map.get(t.categoriaId);
      if (existing) existing.total += parseFloat(t.valor);
      else
        map.set(t.categoriaId, {
          nome: t.categoriaNome ?? t.categoriaId,
          total: parseFloat(t.valor),
        });
    }
    return Array.from(map.entries())
      .map(([categoriaId, { nome, total }]) => ({
        categoriaId,
        categoriaNome: nome,
        total: total.toFixed(2),
      }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
  }

  async getTransacoesPorDia(familiaId: string, mesReferencia: string): Promise<DiaGasto[]> {
    const ts = this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia,
    );
    const map = new Map<string, { despesas: number; receitas: number }>();
    for (const t of ts) {
      const existing = map.get(t.data) ?? { despesas: 0, receitas: 0 };
      if (t.tipo === 'despesa') existing.despesas += parseFloat(t.valor);
      else existing.receitas += parseFloat(t.valor);
      map.set(t.data, existing);
    }
    return Array.from(map.entries()).map(([dia, { despesas, receitas }]) => ({
      dia,
      totalDespesas: despesas.toFixed(2),
      totalReceitas: receitas.toFixed(2),
    }));
  }

  async getOrcamentosVigentes(
    familiaId: string,
    mesReferencia: string,
  ): Promise<OrcamentoVigente[]> {
    return this._orcamentos.filter(
      (o) =>
        o.familiaId === familiaId &&
        o.vigenciaInicio <= mesReferencia &&
        (o.vigenciaFim === null || o.vigenciaFim >= mesReferencia),
    );
  }

  async getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<GastoCategoria[]> {
    const despesas = this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia && t.tipo === 'despesa',
    );
    const map = new Map<string, number>();
    for (const t of despesas) {
      map.set(t.categoriaId, (map.get(t.categoriaId) ?? 0) + parseFloat(t.valor));
    }
    return Array.from(map.entries()).map(([categoriaId, total]) => ({
      categoriaId,
      totalGasto: total.toFixed(2),
    }));
  }
}

// ─── Drizzle ──────────────────────────────────────────────────────────────────

export class DrizzleDashboardRepository implements DashboardRepository {
  async getResumoMes(familiaId: string, mesReferencia: string): Promise<ResumoMes> {
    const rows = await db
      .select({
        totalReceitas: sql<string>`COALESCE(SUM(CASE WHEN ${transacoes.tipo} = 'receita' THEN ${transacoes.valor}::numeric ELSE 0 END), 0)::text`,
        totalDespesas: sql<string>`COALESCE(SUM(CASE WHEN ${transacoes.tipo} = 'despesa' THEN ${transacoes.valor}::numeric ELSE 0 END), 0)::text`,
      })
      .from(transacoes)
      .where(and(eq(transacoes.familiaId, familiaId), eq(transacoes.mesReferencia, mesReferencia)));

    const row = rows[0] ?? { totalReceitas: '0', totalDespesas: '0' };
    const r = parseFloat(row.totalReceitas);
    const d = parseFloat(row.totalDespesas);
    return {
      totalReceitas: r.toFixed(2),
      totalDespesas: d.toFixed(2),
      saldo: (r - d).toFixed(2),
    };
  }

  async getSnapshotMes(familiaId: string, mesReferencia: string): Promise<SnapshotMes | null> {
    const rows = await db
      .select({
        totalReceitas: snapshotsMensais.totalReceitas,
        totalDespesas: snapshotsMensais.totalDespesas,
        saldo: snapshotsMensais.saldo,
      })
      .from(snapshotsMensais)
      .where(
        and(
          eq(snapshotsMensais.familiaId, familiaId),
          eq(snapshotsMensais.mesReferencia, mesReferencia),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async getDistribuicaoCategorias(
    familiaId: string,
    mesReferencia: string,
  ): Promise<CategoriaGasto[]> {
    return db
      .select({
        categoriaId: transacoes.categoriaId,
        categoriaNome: categorias.nome,
        total: sql<string>`SUM(${transacoes.valor}::numeric)::text`,
      })
      .from(transacoes)
      .innerJoin(categorias, eq(transacoes.categoriaId, categorias.id))
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          eq(transacoes.mesReferencia, mesReferencia),
          eq(transacoes.tipo, 'despesa'),
          eq(categorias.sistema, false),
        ),
      )
      .groupBy(transacoes.categoriaId, categorias.nome)
      .orderBy(sql`SUM(${transacoes.valor}::numeric) DESC`);
  }

  async getTransacoesPorDia(familiaId: string, mesReferencia: string): Promise<DiaGasto[]> {
    return db
      .select({
        dia: transacoes.data,
        totalDespesas: sql<string>`COALESCE(SUM(CASE WHEN ${transacoes.tipo} = 'despesa' THEN ${transacoes.valor}::numeric ELSE 0 END), 0)::text`,
        totalReceitas: sql<string>`COALESCE(SUM(CASE WHEN ${transacoes.tipo} = 'receita' THEN ${transacoes.valor}::numeric ELSE 0 END), 0)::text`,
      })
      .from(transacoes)
      .where(and(eq(transacoes.familiaId, familiaId), eq(transacoes.mesReferencia, mesReferencia)))
      .groupBy(transacoes.data)
      .orderBy(transacoes.data);
  }

  async getOrcamentosVigentes(
    familiaId: string,
    mesReferencia: string,
  ): Promise<OrcamentoVigente[]> {
    return db
      .select({
        categoriaId: orcamentoCategoria.categoriaId,
        categoriaNome: categorias.nome,
        valorLimite: orcamentoCategoria.valorLimite,
      })
      .from(orcamentoCategoria)
      .innerJoin(categorias, eq(orcamentoCategoria.categoriaId, categorias.id))
      .where(
        and(
          eq(orcamentoCategoria.familiaId, familiaId),
          lte(orcamentoCategoria.vigenciaInicio, mesReferencia),
          or(
            sql`${orcamentoCategoria.vigenciaFim} IS NULL`,
            gte(orcamentoCategoria.vigenciaFim, mesReferencia),
          ),
        ),
      );
  }

  async getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<GastoCategoria[]> {
    return db
      .select({
        categoriaId: transacoes.categoriaId,
        totalGasto: sql<string>`SUM(${transacoes.valor}::numeric)::text`,
      })
      .from(transacoes)
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          eq(transacoes.mesReferencia, mesReferencia),
          eq(transacoes.tipo, 'despesa'),
        ),
      )
      .groupBy(transacoes.categoriaId);
  }
}
