import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, transacoes, users } from '../../db/schema.js';
import type { RelatorioRepository, RelatorioTransacaoRow } from './relatorio.types.js';

// ─── InMemory ─────────────────────────────────────────────────────────────────

type SeedRelatorioTransacao = Omit<RelatorioTransacaoRow, 'categoriaSistema'> & {
  categoriaSistema?: boolean;
};

export class InMemoryRelatorioRepository implements RelatorioRepository {
  private _transacoes: RelatorioTransacaoRow[] = [];

  seed(data: { transacoes?: SeedRelatorioTransacao[] }): void {
    if (data.transacoes) {
      this._transacoes.push(
        ...data.transacoes.map((t) => ({
          ...t,
          categoriaSistema: t.categoriaSistema ?? false,
        })),
      );
    }
  }

  async getTransacoes(familiaId: string, mesReferencia: string): Promise<RelatorioTransacaoRow[]> {
    return this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia,
    );
  }

  async getTransacoesBatch(
    familiaId: string,
    mesesReferencia: string[],
  ): Promise<RelatorioTransacaoRow[]> {
    return this._transacoes.filter(
      (t) => t.familiaId === familiaId && mesesReferencia.includes(t.mesReferencia),
    );
  }
}

// ─── Drizzle ──────────────────────────────────────────────────────────────────

export class DrizzleRelatorioRepository implements RelatorioRepository {
  async getTransacoes(familiaId: string, mesReferencia: string): Promise<RelatorioTransacaoRow[]> {
    const rows = await db
      .select({
        familiaId: transacoes.familiaId,
        tipo: transacoes.tipo,
        valor: transacoes.valor,
        categoriaId: transacoes.categoriaId,
        categoriaNome: categorias.nome,
        categoriaSistema: categorias.sistema,
        mesReferencia: transacoes.mesReferencia,
        usuarioId: transacoes.usuarioRegistrouId,
        usuarioNome: users.nome,
      })
      .from(transacoes)
      .innerJoin(categorias, eq(transacoes.categoriaId, categorias.id))
      .innerJoin(users, eq(transacoes.usuarioRegistrouId, users.id))
      .where(and(eq(transacoes.familiaId, familiaId), eq(transacoes.mesReferencia, mesReferencia)));

    return rows;
  }

  async getTransacoesBatch(
    familiaId: string,
    mesesReferencia: string[],
  ): Promise<RelatorioTransacaoRow[]> {
    if (mesesReferencia.length === 0) return [];

    const rows = await db
      .select({
        familiaId: transacoes.familiaId,
        tipo: transacoes.tipo,
        valor: transacoes.valor,
        categoriaId: transacoes.categoriaId,
        categoriaNome: categorias.nome,
        categoriaSistema: categorias.sistema,
        mesReferencia: transacoes.mesReferencia,
        usuarioId: transacoes.usuarioRegistrouId,
        usuarioNome: users.nome,
      })
      .from(transacoes)
      .innerJoin(categorias, eq(transacoes.categoriaId, categorias.id))
      .innerJoin(users, eq(transacoes.usuarioRegistrouId, users.id))
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          inArray(transacoes.mesReferencia, mesesReferencia),
        ),
      );

    return rows;
  }
}
