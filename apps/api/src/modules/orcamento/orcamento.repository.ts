import { and, desc, eq, isNull, lte, gte, or, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, orcamentoCategoria, transacoes } from '../../db/schema.js';
import type {
  OrcamentoHistoricoRow,
  OrcamentoRepository,
  OrcamentoSetInput,
  OrcamentoVigenteRow,
} from './orcamento.types.js';

// ─── InMemory ─────────────────────────────────────────────────────────────────

interface InMemoryOrcamento {
  id: string;
  familiaId: string;
  categoriaId: string;
  categoriaNome: string;
  valorLimite: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  criadoEm: Date;
  criadoPor: string;
}

interface InMemoryTransacao {
  familiaId: string;
  categoriaId: string;
  mesReferencia: string;
  valor: string;
  tipo: 'receita' | 'despesa';
}

export class InMemoryOrcamentoRepository implements OrcamentoRepository {
  private _orcamentos: InMemoryOrcamento[] = [];
  private _transacoes: InMemoryTransacao[] = [];

  seedTransacao(t: { familiaId: string; categoriaId: string; mesReferencia: string; valor: string; tipo?: 'receita' | 'despesa' }): void {
    this._transacoes.push({ ...t, tipo: t.tipo ?? 'despesa' });
  }

  async listVigentes(familiaId: string, mesReferencia: string): Promise<OrcamentoVigenteRow[]> {
    return this._orcamentos
      .filter(
        (o) =>
          o.familiaId === familiaId &&
          o.vigenciaInicio <= mesReferencia &&
          (o.vigenciaFim === null || o.vigenciaFim >= mesReferencia),
      )
      .map((o) => ({
        id: o.id,
        categoriaId: o.categoriaId,
        categoriaNome: o.categoriaNome,
        valorLimite: o.valorLimite,
        vigenciaInicio: o.vigenciaInicio,
        vigenciaFim: o.vigenciaFim,
      }));
  }

  async getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<Map<string, string>> {
    const despesas = this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia && t.tipo === 'despesa',
    );
    const map = new Map<string, number>();
    for (const t of despesas) {
      map.set(t.categoriaId, (map.get(t.categoriaId) ?? 0) + parseFloat(t.valor));
    }
    const result = new Map<string, string>();
    for (const [categoriaId, total] of map.entries()) {
      result.set(categoriaId, total.toFixed(2));
    }
    return result;
  }

  async findAberto(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow | null> {
    const found = this._orcamentos.find(
      (o) => o.familiaId === familiaId && o.categoriaId === categoriaId && o.vigenciaFim === null,
    );
    if (!found) return null;
    return {
      id: found.id,
      categoriaId: found.categoriaId,
      valorLimite: found.valorLimite,
      vigenciaInicio: found.vigenciaInicio,
      vigenciaFim: found.vigenciaFim,
      criadoEm: found.criadoEm,
    };
  }

  async encerrar(id: string, vigenciaFim: string): Promise<void> {
    const record = this._orcamentos.find((o) => o.id === id);
    if (record) {
      record.vigenciaFim = vigenciaFim;
    }
  }

  async insert(input: OrcamentoSetInput): Promise<OrcamentoHistoricoRow> {
    const record: InMemoryOrcamento = {
      id: crypto.randomUUID(),
      familiaId: input.familiaId,
      categoriaId: input.categoriaId,
      categoriaNome: input.categoriaId,
      valorLimite: input.valorLimite,
      vigenciaInicio: input.vigenciaInicio,
      vigenciaFim: null,
      criadoEm: new Date(),
      criadoPor: input.usuarioId,
    };
    this._orcamentos.push(record);
    return {
      id: record.id,
      categoriaId: record.categoriaId,
      valorLimite: record.valorLimite,
      vigenciaInicio: record.vigenciaInicio,
      vigenciaFim: record.vigenciaFim,
      criadoEm: record.criadoEm,
    };
  }

  async listHistorico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow[]> {
    return this._orcamentos
      .filter((o) => o.familiaId === familiaId && o.categoriaId === categoriaId)
      .sort((a, b) => (a.vigenciaInicio < b.vigenciaInicio ? 1 : -1))
      .map((o) => ({
        id: o.id,
        categoriaId: o.categoriaId,
        valorLimite: o.valorLimite,
        vigenciaInicio: o.vigenciaInicio,
        vigenciaFim: o.vigenciaFim,
        criadoEm: o.criadoEm,
      }));
  }
}

// ─── Drizzle ──────────────────────────────────────────────────────────────────

export class DrizzleOrcamentoRepository implements OrcamentoRepository {
  async listVigentes(familiaId: string, mesReferencia: string): Promise<OrcamentoVigenteRow[]> {
    return db
      .select({
        id: orcamentoCategoria.id,
        categoriaId: orcamentoCategoria.categoriaId,
        categoriaNome: categorias.nome,
        valorLimite: orcamentoCategoria.valorLimite,
        vigenciaInicio: orcamentoCategoria.vigenciaInicio,
        vigenciaFim: orcamentoCategoria.vigenciaFim,
      })
      .from(orcamentoCategoria)
      .innerJoin(categorias, eq(orcamentoCategoria.categoriaId, categorias.id))
      .where(
        and(
          eq(orcamentoCategoria.familiaId, familiaId),
          lte(orcamentoCategoria.vigenciaInicio, mesReferencia),
          or(
            isNull(orcamentoCategoria.vigenciaFim),
            gte(orcamentoCategoria.vigenciaFim, mesReferencia),
          ),
        ),
      );
  }

  async getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<Map<string, string>> {
    const rows = await db
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

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.categoriaId, parseFloat(row.totalGasto).toFixed(2));
    }
    return map;
  }

  async findAberto(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow | null> {
    const rows = await db
      .select({
        id: orcamentoCategoria.id,
        categoriaId: orcamentoCategoria.categoriaId,
        valorLimite: orcamentoCategoria.valorLimite,
        vigenciaInicio: orcamentoCategoria.vigenciaInicio,
        vigenciaFim: orcamentoCategoria.vigenciaFim,
        criadoEm: orcamentoCategoria.criadoEm,
      })
      .from(orcamentoCategoria)
      .where(
        and(
          eq(orcamentoCategoria.familiaId, familiaId),
          eq(orcamentoCategoria.categoriaId, categoriaId),
          isNull(orcamentoCategoria.vigenciaFim),
        ),
      )
      .limit(1);

    if (!rows[0]) return null;
    return rows[0];
  }

  async encerrar(id: string, vigenciaFim: string): Promise<void> {
    await db
      .update(orcamentoCategoria)
      .set({ vigenciaFim })
      .where(eq(orcamentoCategoria.id, id));
  }

  async insert(input: OrcamentoSetInput): Promise<OrcamentoHistoricoRow> {
    const rows = await db
      .insert(orcamentoCategoria)
      .values({
        familiaId: input.familiaId,
        categoriaId: input.categoriaId,
        valorLimite: input.valorLimite,
        vigenciaInicio: input.vigenciaInicio,
        criadoPor: input.usuarioId,
      })
      .returning({
        id: orcamentoCategoria.id,
        categoriaId: orcamentoCategoria.categoriaId,
        valorLimite: orcamentoCategoria.valorLimite,
        vigenciaInicio: orcamentoCategoria.vigenciaInicio,
        vigenciaFim: orcamentoCategoria.vigenciaFim,
        criadoEm: orcamentoCategoria.criadoEm,
      });

    return rows[0];
  }

  async listHistorico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow[]> {
    return db
      .select({
        id: orcamentoCategoria.id,
        categoriaId: orcamentoCategoria.categoriaId,
        valorLimite: orcamentoCategoria.valorLimite,
        vigenciaInicio: orcamentoCategoria.vigenciaInicio,
        vigenciaFim: orcamentoCategoria.vigenciaFim,
        criadoEm: orcamentoCategoria.criadoEm,
      })
      .from(orcamentoCategoria)
      .where(
        and(
          eq(orcamentoCategoria.familiaId, familiaId),
          eq(orcamentoCategoria.categoriaId, categoriaId),
        ),
      )
      .orderBy(desc(orcamentoCategoria.vigenciaInicio));
  }
}
