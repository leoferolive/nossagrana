import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, snapshotsMensais, transacoes, users } from '../../db/schema.js';
import type {
  HistoricoRepository,
  SnapshotInsertInput,
  SnapshotRow,
  TransacaoCategoriaSumaRow,
  TransacaoResumoRow,
  TransacaoUsuarioSumaRow,
} from './historico.types.js';

// ─── InMemory ─────────────────────────────────────────────────────────────────

interface InMemoryTransacaoResumo {
  familiaId: string;
  mesReferencia: string;
  totalReceitas: string;
  totalDespesas: string;
}

interface InMemoryTransacaoSnapshotData {
  totalReceitas: string;
  totalDespesas: string;
  porCategoria: { categoriaId: string; categoriaNome: string; total: string }[];
  porUsuario: { usuarioId: string; usuarioNome: string; total: string }[];
}

export class InMemoryHistoricoRepository implements HistoricoRepository {
  private _snapshots: (SnapshotRow & { id: string })[] = [];
  private _transacoesResumo: InMemoryTransacaoResumo[] = [];
  private _snapshotData = new Map<string, InMemoryTransacaoSnapshotData>();

  seedTransacao(t: {
    familiaId: string;
    mesReferencia: string;
    totalReceitas: string;
    totalDespesas: string;
  }): void {
    this._transacoesResumo.push(t);
  }

  seedSnapshot(s: {
    familiaId: string;
    mesReferencia: string;
    totalReceitas: string;
    totalDespesas: string;
    saldo: string;
    divergente: boolean;
    dadosCategorias: { categoriaId: string; categoriaNome: string; total: string }[];
    dadosUsuarios: { usuarioId: string; usuarioNome: string; total: string }[];
    geradoEm: Date;
  }): void {
    this._snapshots.push({ id: crypto.randomUUID(), ...s });
  }

  seedTransacaoParaSnapshot(
    familiaId: string,
    mesReferencia: string,
    data: InMemoryTransacaoSnapshotData,
  ): void {
    this._transacoesResumo.push({
      familiaId,
      mesReferencia,
      totalReceitas: data.totalReceitas,
      totalDespesas: data.totalDespesas,
    });
    this._snapshotData.set(`${familiaId}:${mesReferencia}`, data);
  }

  async listSnapshots(familiaId: string): Promise<SnapshotRow[]> {
    return this._snapshots
      .filter((s) => s.familiaId === familiaId)
      .sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia));
  }

  async findSnapshot(familiaId: string, mesReferencia: string): Promise<SnapshotRow | null> {
    return (
      this._snapshots.find((s) => s.familiaId === familiaId && s.mesReferencia === mesReferencia) ??
      null
    );
  }

  async getResumoTransacoesMes(
    familiaId: string,
    mesReferencia: string,
  ): Promise<TransacaoResumoRow> {
    const t = this._transacoesResumo.find(
      (r) => r.familiaId === familiaId && r.mesReferencia === mesReferencia,
    );
    if (!t) return { mesReferencia, totalReceitas: '0.00', totalDespesas: '0.00', saldo: '0.00' };
    const saldo = (parseFloat(t.totalReceitas) - parseFloat(t.totalDespesas)).toFixed(2);
    return { mesReferencia, totalReceitas: t.totalReceitas, totalDespesas: t.totalDespesas, saldo };
  }

  async getMesesComTransacoes(familiaId: string): Promise<string[]> {
    const mesesSnapshot = this._snapshots
      .filter((s) => s.familiaId === familiaId)
      .map((s) => s.mesReferencia);
    const mesesTransacao = this._transacoesResumo
      .filter((t) => t.familiaId === familiaId)
      .map((t) => t.mesReferencia);
    const all = new Set([...mesesSnapshot, ...mesesTransacao]);
    return Array.from(all).sort((a, b) => b.localeCompare(a));
  }

  async marcarDivergente(familiaId: string, mesReferencia: string): Promise<void> {
    const snap = this._snapshots.find(
      (s) => s.familiaId === familiaId && s.mesReferencia === mesReferencia,
    );
    if (snap) snap.divergente = true;
  }

  async insertSnapshot(input: SnapshotInsertInput): Promise<SnapshotRow> {
    const row: SnapshotRow = {
      id: crypto.randomUUID(),
      familiaId: input.familiaId,
      mesReferencia: input.mesReferencia,
      totalReceitas: input.totalReceitas,
      totalDespesas: input.totalDespesas,
      saldo: input.saldo,
      dadosCategorias: input.dadosCategorias,
      dadosUsuarios: input.dadosUsuarios,
      divergente: false,
      geradoEm: new Date(),
    };
    this._snapshots.push(row);
    return row;
  }

  async getTransacoesPorCategoria(
    familiaId: string,
    mesReferencia: string,
  ): Promise<TransacaoCategoriaSumaRow[]> {
    const data = this._snapshotData.get(`${familiaId}:${mesReferencia}`);
    return (data?.porCategoria ?? []).map((r) => ({ mesReferencia, ...r }));
  }

  async getTransacoesPorUsuario(
    familiaId: string,
    mesReferencia: string,
  ): Promise<TransacaoUsuarioSumaRow[]> {
    const data = this._snapshotData.get(`${familiaId}:${mesReferencia}`);
    return (data?.porUsuario ?? []).map((r) => ({ mesReferencia, ...r }));
  }
}

// ─── Drizzle ──────────────────────────────────────────────────────────────────

export class DrizzleHistoricoRepository implements HistoricoRepository {
  async listSnapshots(familiaId: string): Promise<SnapshotRow[]> {
    const rows = await db
      .select()
      .from(snapshotsMensais)
      .where(eq(snapshotsMensais.familiaId, familiaId))
      .orderBy(desc(snapshotsMensais.mesReferencia));

    return rows.map((r) => ({
      id: r.id,
      familiaId: r.familiaId,
      mesReferencia: r.mesReferencia,
      totalReceitas: r.totalReceitas,
      totalDespesas: r.totalDespesas,
      saldo: r.saldo,
      dadosCategorias: r.dadosCategorias as SnapshotRow['dadosCategorias'],
      dadosUsuarios: r.dadosUsuarios as SnapshotRow['dadosUsuarios'],
      divergente: r.divergente,
      geradoEm: r.geradoEm,
    }));
  }

  async findSnapshot(familiaId: string, mesReferencia: string): Promise<SnapshotRow | null> {
    const [row] = await db
      .select()
      .from(snapshotsMensais)
      .where(
        and(
          eq(snapshotsMensais.familiaId, familiaId),
          eq(snapshotsMensais.mesReferencia, mesReferencia),
        ),
      )
      .limit(1);

    if (!row) return null;
    return {
      id: row.id,
      familiaId: row.familiaId,
      mesReferencia: row.mesReferencia,
      totalReceitas: row.totalReceitas,
      totalDespesas: row.totalDespesas,
      saldo: row.saldo,
      dadosCategorias: row.dadosCategorias as SnapshotRow['dadosCategorias'],
      dadosUsuarios: row.dadosUsuarios as SnapshotRow['dadosUsuarios'],
      divergente: row.divergente,
      geradoEm: row.geradoEm,
    };
  }

  async getResumoTransacoesMes(
    familiaId: string,
    mesReferencia: string,
  ): Promise<TransacaoResumoRow> {
    const [row] = await db
      .select({
        totalReceitas: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'receita' then ${transacoes.valor}::numeric else 0 end), 0)::text`,
        totalDespesas: sql<string>`coalesce(sum(case when ${transacoes.tipo} = 'despesa' then ${transacoes.valor}::numeric else 0 end), 0)::text`,
      })
      .from(transacoes)
      .where(and(eq(transacoes.familiaId, familiaId), eq(transacoes.mesReferencia, mesReferencia)));

    const totalReceitas = parseFloat(row?.totalReceitas ?? '0').toFixed(2);
    const totalDespesas = parseFloat(row?.totalDespesas ?? '0').toFixed(2);
    const saldo = (parseFloat(totalReceitas) - parseFloat(totalDespesas)).toFixed(2);
    return { mesReferencia, totalReceitas, totalDespesas, saldo };
  }

  async getMesesComTransacoes(familiaId: string): Promise<string[]> {
    const [transacoesMeses, snapshotMeses] = await Promise.all([
      db
        .selectDistinct({ mesReferencia: transacoes.mesReferencia })
        .from(transacoes)
        .where(eq(transacoes.familiaId, familiaId)),
      db
        .select({ mesReferencia: snapshotsMensais.mesReferencia })
        .from(snapshotsMensais)
        .where(eq(snapshotsMensais.familiaId, familiaId)),
    ]);

    const all = new Set([
      ...transacoesMeses.map((r) => r.mesReferencia),
      ...snapshotMeses.map((r) => r.mesReferencia),
    ]);
    return Array.from(all).sort((a, b) => b.localeCompare(a));
  }

  async marcarDivergente(familiaId: string, mesReferencia: string): Promise<void> {
    await db
      .update(snapshotsMensais)
      .set({ divergente: true })
      .where(
        and(
          eq(snapshotsMensais.familiaId, familiaId),
          eq(snapshotsMensais.mesReferencia, mesReferencia),
        ),
      );
  }

  async insertSnapshot(input: SnapshotInsertInput): Promise<SnapshotRow> {
    const [row] = await db
      .insert(snapshotsMensais)
      .values({
        familiaId: input.familiaId,
        mesReferencia: input.mesReferencia,
        totalReceitas: input.totalReceitas,
        totalDespesas: input.totalDespesas,
        saldo: input.saldo,
        dadosCategorias: input.dadosCategorias,
        dadosUsuarios: input.dadosUsuarios,
      })
      .returning();

    return {
      id: row.id,
      familiaId: row.familiaId,
      mesReferencia: row.mesReferencia,
      totalReceitas: row.totalReceitas,
      totalDespesas: row.totalDespesas,
      saldo: row.saldo,
      dadosCategorias: row.dadosCategorias as SnapshotRow['dadosCategorias'],
      dadosUsuarios: row.dadosUsuarios as SnapshotRow['dadosUsuarios'],
      divergente: row.divergente,
      geradoEm: row.geradoEm,
    };
  }

  async getTransacoesPorCategoria(
    familiaId: string,
    mesReferencia: string,
  ): Promise<TransacaoCategoriaSumaRow[]> {
    const rows = await db
      .select({
        categoriaId: transacoes.categoriaId,
        categoriaNome: categorias.nome,
        total: sql<string>`sum(${transacoes.valor}::numeric)::text`,
      })
      .from(transacoes)
      .innerJoin(categorias, eq(transacoes.categoriaId, categorias.id))
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          eq(transacoes.mesReferencia, mesReferencia),
          eq(transacoes.tipo, 'despesa'),
        ),
      )
      .groupBy(transacoes.categoriaId, categorias.nome);

    return rows.map((r) => ({
      mesReferencia,
      categoriaId: r.categoriaId,
      categoriaNome: r.categoriaNome,
      total: parseFloat(r.total).toFixed(2),
    }));
  }

  async getTransacoesPorUsuario(
    familiaId: string,
    mesReferencia: string,
  ): Promise<TransacaoUsuarioSumaRow[]> {
    const rows = await db
      .select({
        usuarioId: transacoes.usuarioRegistrouId,
        usuarioNome: users.nome,
        total: sql<string>`sum(${transacoes.valor}::numeric)::text`,
      })
      .from(transacoes)
      .innerJoin(users, eq(transacoes.usuarioRegistrouId, users.id))
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          eq(transacoes.mesReferencia, mesReferencia),
          eq(transacoes.tipo, 'despesa'),
        ),
      )
      .groupBy(transacoes.usuarioRegistrouId, users.nome);

    return rows.map((r) => ({
      mesReferencia,
      usuarioId: r.usuarioId,
      usuarioNome: r.usuarioNome,
      total: parseFloat(r.total).toFixed(2),
    }));
  }
}
