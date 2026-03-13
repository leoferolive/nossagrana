import { randomBytes, randomUUID } from 'node:crypto';

import { and, eq, gt, isNull } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { convites, familias, usuarioFamilia } from '../../db/schema.js';
import type {
  CreatedFamilia,
  CreatedFamiliaInvite,
  CreateFamiliaInput,
  CreateFamiliaInviteInput,
  JoinFamiliaByInviteInput,
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

  async joinByInvite(input: JoinFamiliaByInviteInput): Promise<CreatedFamilia | null> {
    const now = new Date();

    return db.transaction(async (tx) => {
      const [invite] = await tx
        .select({
          id: convites.id,
          familiaId: convites.familiaId,
          familiaNome: familias.nome,
          familiaDataCriacao: familias.dataCriacao,
        })
        .from(convites)
        .innerJoin(familias, eq(familias.id, convites.familiaId))
        .where(
          and(
            eq(convites.codigo, input.codigo),
            isNull(convites.usadoPor),
            gt(convites.expiraEm, now),
          ),
        )
        .limit(1);

      if (!invite) {
        return null;
      }

      await tx
        .insert(usuarioFamilia)
        .values({
          usuarioId: input.usuarioId,
          familiaId: invite.familiaId,
          role: 'membro',
        })
        .onConflictDoNothing();

      await tx
        .update(convites)
        .set({
          usadoPor: input.usuarioId,
          usadoEm: now,
        })
        .where(eq(convites.id, invite.id));

      return {
        id: invite.familiaId,
        nome: invite.familiaNome,
        dataCriacao: invite.familiaDataCriacao,
      };
    });
  }
}

export class InMemoryFamiliaRepository implements FamiliaRepository {
  private familiasById = new Map<string, CreatedFamilia>();
  private membershipsByFamiliaId = new Map<string, Map<string, 'admin' | 'membro'>>();
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
    this.membershipsByFamiliaId.set(id, new Map([[input.usuarioId, 'admin']]));
    return familia;
  }

  async isUserAdmin(input: { familiaId: string; usuarioId: string }): Promise<boolean> {
    const memberships = this.membershipsByFamiliaId.get(input.familiaId);
    if (!memberships) {
      return false;
    }

    return memberships.get(input.usuarioId) === 'admin';
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

  async joinByInvite(input: JoinFamiliaByInviteInput): Promise<CreatedFamilia | null> {
    const now = new Date();
    const invite = Array.from(this.invitesById.values()).find(
      (entry) => entry.codigo === input.codigo && entry.expiraEm > now,
    );

    if (!invite) {
      return null;
    }

    const memberships = this.membershipsByFamiliaId.get(invite.familiaId);
    if (!memberships) {
      return null;
    }

    memberships.set(input.usuarioId, 'membro');
    this.invitesById.delete(invite.id);

    return this.familiasById.get(invite.familiaId) ?? null;
  }
}
