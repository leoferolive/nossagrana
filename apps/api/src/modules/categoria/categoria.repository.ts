import { and, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias } from '../../db/schema.js';
import type { Categoria, CategoriaRepository } from './categoria.types.js';

export class DrizzleCategoriaRepository implements CategoriaRepository {
  async listByFamiliaId(input: { familiaId: string }): Promise<Categoria[]> {
    const found = await db
      .select({
        id: categorias.id,
        familiaId: categorias.familiaId,
        nome: categorias.nome,
        tipo: categorias.tipo,
        ativo: categorias.ativo,
        criadoPor: categorias.criadoPor,
        criadoEm: categorias.criadoEm,
      })
      .from(categorias)
      .where(and(eq(categorias.familiaId, input.familiaId), eq(categorias.ativo, true)));

    return found.map((categoria) => ({
      ...categoria,
      tipo: categoria.tipo as 'receita' | 'despesa',
      ativo: categoria.ativo,
      criadoEm: categoria.criadoEm,
    }));
  }
}

export class InMemoryCategoriaRepository implements CategoriaRepository {
  private categorias: Categoria[] = [];

  async listByFamiliaId(input: { familiaId: string }): Promise<Categoria[]> {
    return this.categorias.filter((categoria) => categoria.familiaId === input.familiaId && categoria.ativo);
  }
}
