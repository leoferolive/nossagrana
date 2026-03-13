import { randomBytes, randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { convites, familias, usuarioFamilia } from '../../db/schema.js';
import type {
  CreatedFamilia,
  CreatedFamiliaInvite,
  CreateFamiliaInput,
  CreateFamiliaInviteInput,
  FamiliaRepository,
} from './familia.types.js';

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

  async isUserAdmin(input: { familiaId: string; usuarioId: string }): Promise<boolean> {
    const [membership] = await db
      .select({ role: usuarioFamilia.role })
      .from(usuarioFamilia)
      .where(
        and(
          eq(usuarioFamilia.familiaId, input.familiaId),
          eq(usuarioFamilia.usuarioId, input.usuarioId),
          eq(usuarioFamilia.role, 'admin'),
        ),
      )
      .limit(1);

    return Boolean(membership);
  }

  async createInvite(input: CreateFamiliaInviteInput): Promise<CreatedFamiliaInvite> {
    const code = randomBytes(6).toString('hex').toUpperCase();
    const now = new Date();
    const expiraEm = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [createdInvite] = await db
      .insert(convites)
      .values({
        familiaId: input.familiaId,
        criadoPor: input.criadoPor,
        codigo: code,
        expiraEm,
      })
      .returning({
        id: convites.id,
        familiaId: convites.familiaId,
        codigo: convites.codigo,
        expiraEm: convites.expiraEm,
        criadoPor: convites.criadoPor,
        dataCriacao: convites.dataCriacao,
      });

    return createdInvite;
  }
}

export class InMemoryFamiliaRepository implements FamiliaRepository {
  private familiasById = new Map<string, CreatedFamilia>();
  private adminMembershipsByFamiliaId = new Map<string, Set<string>>();
  private invitesById = new Map<string, CreatedFamiliaInvite>();

  async createWithAdminMembership(input: CreateFamiliaInput): Promise<CreatedFamilia> {
    const id = randomUUID();
    const now = new Date();
    const familia: CreatedFamilia = {
      id,
      nome: input.nome,
      dataCriacao: now,
    };

    this.familiasById.set(id, familia);
    this.adminMembershipsByFamiliaId.set(id, new Set([input.usuarioId]));
    return familia;
  }

  async isUserAdmin(input: { familiaId: string; usuarioId: string }): Promise<boolean> {
    const admins = this.adminMembershipsByFamiliaId.get(input.familiaId);
    if (!admins) {
      return false;
    }

    return admins.has(input.usuarioId);
  }

  async createInvite(input: CreateFamiliaInviteInput): Promise<CreatedFamiliaInvite> {
    const id = randomUUID();
    const now = new Date();
    const invite: CreatedFamiliaInvite = {
      id,
      familiaId: input.familiaId,
      criadoPor: input.criadoPor,
      codigo: randomBytes(6).toString('hex').toUpperCase(),
      expiraEm: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      dataCriacao: now,
    };

    this.invitesById.set(id, invite);
    return invite;
  }
}
