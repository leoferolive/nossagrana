import { randomUUID } from 'node:crypto';

import { db } from '../../db/client.js';
import { familias, usuarioFamilia } from '../../db/schema.js';
import type { CreatedFamilia, CreateFamiliaInput, FamiliaRepository } from './familia.types.js';

export class DrizzleFamiliaRepository implements FamiliaRepository {
  async createWithAdminMembership(input: CreateFamiliaInput): Promise<CreatedFamilia> {
    return db.transaction(async (tx) => {
      const [createdFamilia] = await tx
        .insert(familias)
        .values({
          nome: input.nome,
        })
        .returning({
          id: familias.id,
          nome: familias.nome,
          dataCriacao: familias.dataCriacao,
        });

      await tx.insert(usuarioFamilia).values({
        usuarioId: input.usuarioId,
        familiaId: createdFamilia.id,
        role: 'admin',
      });

      return createdFamilia;
    });
  }
}

export class InMemoryFamiliaRepository implements FamiliaRepository {
  private familiasById = new Map<string, CreatedFamilia>();

  async createWithAdminMembership(input: CreateFamiliaInput): Promise<CreatedFamilia> {
    const id = randomUUID();
    const now = new Date();
    const familia: CreatedFamilia = {
      id,
      nome: input.nome,
      dataCriacao: now,
    };

    this.familiasById.set(id, familia);
    return familia;
  }
}
