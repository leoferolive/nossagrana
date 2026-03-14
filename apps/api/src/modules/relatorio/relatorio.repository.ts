import { and, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, transacoes, users } from '../../db/schema.js';
import type { RelatorioRepository, RelatorioTransacaoRow } from './relatorio.types.js';

// ─── InMemory ─────────────────────────────────────────────────────────────────

export class InMemoryRelatorioRepository implements RelatorioRepository {
  private _transacoes: RelatorioTransacaoRow[] = [];

  seed(data: { transacoes?: RelatorioTransacaoRow[] }): void {
    if (data.transacoes) {
      this._transacoes.push(...data.transacoes);
    }
  }

  async getTransacoes(familiaId: string, mesReferencia: string): Promise<RelatorioTransacaoRow[]> {
    return this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia,
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
          eq(transacoes.mesReferencia, mesReferencia),
        ),
      );

    return rows;
  }
}
