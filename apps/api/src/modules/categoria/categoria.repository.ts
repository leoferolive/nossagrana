import { randomUUID } from 'node:crypto';

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
        sistema: categorias.sistema,
        criadoPor: categorias.criadoPor,
        criadoEm: categorias.criadoEm,
      })
      .from(categorias)
      .where(and(eq(categorias.familiaId, input.familiaId), eq(categorias.ativo, true)));

    return found.map((categoria) => ({
      ...categoria,
      tipo: categoria.tipo as 'receita' | 'despesa',
    }));
  }

  async findById(input: { id: string; familiaId: string }): Promise<Categoria | null> {
    const [found] = await db
      .select({
        id: categorias.id,
        familiaId: categorias.familiaId,
        nome: categorias.nome,
        tipo: categorias.tipo,
        ativo: categorias.ativo,
        sistema: categorias.sistema,
        criadoPor: categorias.criadoPor,
        criadoEm: categorias.criadoEm,
      })
      .from(categorias)
      .where(and(eq(categorias.id, input.id), eq(categorias.familiaId, input.familiaId)));

    if (!found) {
      return null;
    }

    return {
      ...found,
      tipo: found.tipo as 'receita' | 'despesa',
    };
  }

  async create(input: {
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
    criadoPor: string;
    sistema?: boolean;
  }): Promise<Categoria> {
    const [created] = await db
      .insert(categorias)
      .values({
        familiaId: input.familiaId,
        nome: input.nome,
        tipo: input.tipo,
        ativo: true,
        sistema: input.sistema ?? false,
        criadoPor: input.criadoPor,
      })
      .returning({
        id: categorias.id,
        familiaId: categorias.familiaId,
        nome: categorias.nome,
        tipo: categorias.tipo,
        ativo: categorias.ativo,
        sistema: categorias.sistema,
        criadoPor: categorias.criadoPor,
        criadoEm: categorias.criadoEm,
      });

    return {
      ...created,
      tipo: created.tipo as 'receita' | 'despesa',
    };
  }

  async update(input: {
    id: string;
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
  }): Promise<Categoria | null> {
    const [updated] = await db
      .update(categorias)
      .set({
        nome: input.nome,
        tipo: input.tipo,
      })
      .where(
        and(
          eq(categorias.id, input.id),
          eq(categorias.familiaId, input.familiaId),
          eq(categorias.ativo, true),
        ),
      )
      .returning({
        id: categorias.id,
        familiaId: categorias.familiaId,
        nome: categorias.nome,
        tipo: categorias.tipo,
        ativo: categorias.ativo,
        sistema: categorias.sistema,
        criadoPor: categorias.criadoPor,
        criadoEm: categorias.criadoEm,
      });

    if (!updated) {
      return null;
    }

    return {
      ...updated,
      tipo: updated.tipo as 'receita' | 'despesa',
    };
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<Categoria | null> {
    const [updated] = await db
      .update(categorias)
      .set({ ativo: false })
      .where(
        and(
          eq(categorias.id, input.id),
          eq(categorias.familiaId, input.familiaId),
          eq(categorias.ativo, true),
        ),
      )
      .returning({
        id: categorias.id,
        familiaId: categorias.familiaId,
        nome: categorias.nome,
        tipo: categorias.tipo,
        ativo: categorias.ativo,
        sistema: categorias.sistema,
        criadoPor: categorias.criadoPor,
        criadoEm: categorias.criadoEm,
      });

    if (!updated) {
      return null;
    }

    return {
      ...updated,
      tipo: updated.tipo as 'receita' | 'despesa',
    };
  }
}

export class InMemoryCategoriaRepository implements CategoriaRepository {
  private categorias: Categoria[] = [];

  async listByFamiliaId(input: { familiaId: string }): Promise<Categoria[]> {
    return this.categorias.filter(
      (categoria) => categoria.familiaId === input.familiaId && categoria.ativo,
    );
  }

  async findById(input: { id: string; familiaId: string }): Promise<Categoria | null> {
    return (
      this.categorias.find(
        (categoria) => categoria.id === input.id && categoria.familiaId === input.familiaId,
      ) ?? null
    );
  }

  async create(input: {
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
    criadoPor: string;
    sistema?: boolean;
  }): Promise<Categoria> {
    const created: Categoria = {
      id: randomUUID(),
      familiaId: input.familiaId,
      nome: input.nome,
      tipo: input.tipo,
      ativo: true,
      sistema: input.sistema ?? false,
      criadoPor: input.criadoPor,
      criadoEm: new Date(),
    };

    this.categorias.push(created);

    return created;
  }

  async update(input: {
    id: string;
    familiaId: string;
    nome: string;
    tipo: 'receita' | 'despesa';
  }): Promise<Categoria | null> {
    const index = this.categorias.findIndex(
      (categoria) =>
        categoria.id === input.id && categoria.familiaId === input.familiaId && categoria.ativo,
    );

    if (index === -1) {
      return null;
    }

    const updated: Categoria = {
      ...this.categorias[index],
      nome: input.nome,
      tipo: input.tipo,
    };
    this.categorias[index] = updated;

    return updated;
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<Categoria | null> {
    const index = this.categorias.findIndex(
      (categoria) =>
        categoria.id === input.id && categoria.familiaId === input.familiaId && categoria.ativo,
    );

    if (index === -1) {
      return null;
    }

    const deactivated: Categoria = { ...this.categorias[index], ativo: false };
    this.categorias[index] = deactivated;

    return deactivated;
  }
}
