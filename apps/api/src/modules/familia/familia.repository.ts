import { randomBytes, randomUUID } from 'node:crypto';

import { and, eq, gt, ilike, isNull } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { convites, familias, solicitacoesEntrada, usuarioFamilia } from '../../db/schema.js';
import type {
  CreatedFamilia,
  CreatedFamiliaInvite,
  CreatedFamiliaJoinRequest,
  CreateFamiliaInput,
  CreateFamiliaInviteInput,
  FamiliaRepository,
  JoinFamiliaByInviteInput,
  RequestFamiliaJoinInput,
  ReviewedFamiliaJoinRequest,
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

  async hasMembership(input: { familiaId: string; usuarioId: string }): Promise<boolean> {
    const [membership] = await db
      .select({ usuarioId: usuarioFamilia.usuarioId })
      .from(usuarioFamilia)
      .where(
        and(
          eq(usuarioFamilia.familiaId, input.familiaId),
          eq(usuarioFamilia.usuarioId, input.usuarioId),
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

  async requestJoin(input: RequestFamiliaJoinInput): Promise<CreatedFamiliaJoinRequest> {
    const [joinRequest] = await db
      .insert(solicitacoesEntrada)
      .values({
        familiaId: input.familiaId,
        usuarioId: input.usuarioId,
        status: 'pendente',
      })
      .returning({
        id: solicitacoesEntrada.id,
        familiaId: solicitacoesEntrada.familiaId,
        usuarioId: solicitacoesEntrada.usuarioId,
        status: solicitacoesEntrada.status,
        solicitadoEm: solicitacoesEntrada.solicitadoEm,
      });

    return {
      ...joinRequest,
      status: 'pendente',
    };
  }

  async listPendingJoinRequests(input: {
    familiaId: string;
  }): Promise<CreatedFamiliaJoinRequest[]> {
    const requests = await db
      .select({
        id: solicitacoesEntrada.id,
        familiaId: solicitacoesEntrada.familiaId,
        usuarioId: solicitacoesEntrada.usuarioId,
        status: solicitacoesEntrada.status,
        solicitadoEm: solicitacoesEntrada.solicitadoEm,
      })
      .from(solicitacoesEntrada)
      .where(
        and(
          eq(solicitacoesEntrada.familiaId, input.familiaId),
          eq(solicitacoesEntrada.status, 'pendente'),
        ),
      );

    return requests.map((request) => ({
      ...request,
      status: 'pendente',
    }));
  }

  async reviewJoinRequest(input: {
    solicitacaoId: string;
    familiaId: string;
    adminId: string;
    acao: 'aprovar' | 'rejeitar';
  }): Promise<ReviewedFamiliaJoinRequest | null> {
    const now = new Date();
    const reviewedStatus = input.acao === 'aprovar' ? 'aprovada' : 'rejeitada';

    return db.transaction(async (tx) => {
      const [pending] = await tx
        .select({
          id: solicitacoesEntrada.id,
          familiaId: solicitacoesEntrada.familiaId,
          usuarioId: solicitacoesEntrada.usuarioId,
          solicitadoEm: solicitacoesEntrada.solicitadoEm,
        })
        .from(solicitacoesEntrada)
        .where(
          and(
            eq(solicitacoesEntrada.id, input.solicitacaoId),
            eq(solicitacoesEntrada.familiaId, input.familiaId),
            eq(solicitacoesEntrada.status, 'pendente'),
          ),
        )
        .limit(1);

      if (!pending) {
        return null;
      }

      const [reviewed] = await tx
        .update(solicitacoesEntrada)
        .set({
          status: reviewedStatus,
          respondidoEm: now,
          respondidoPor: input.adminId,
        })
        .where(eq(solicitacoesEntrada.id, pending.id))
        .returning({
          id: solicitacoesEntrada.id,
          familiaId: solicitacoesEntrada.familiaId,
          usuarioId: solicitacoesEntrada.usuarioId,
          status: solicitacoesEntrada.status,
          solicitadoEm: solicitacoesEntrada.solicitadoEm,
          respondidoEm: solicitacoesEntrada.respondidoEm,
          respondidoPor: solicitacoesEntrada.respondidoPor,
        });

      if (reviewedStatus === 'aprovada') {
        await tx
          .insert(usuarioFamilia)
          .values({
            usuarioId: pending.usuarioId,
            familiaId: pending.familiaId,
            role: 'membro',
          })
          .onConflictDoNothing();
      }

      return {
        id: reviewed.id,
        familiaId: reviewed.familiaId,
        usuarioId: reviewed.usuarioId,
        status: reviewedStatus,
        solicitadoEm: reviewed.solicitadoEm,
        respondidoEm: reviewed.respondidoEm ?? now,
        respondidoPor: reviewed.respondidoPor ?? input.adminId,
      };
    });
  }

  async listMembers(input: { familiaId: string }) {
    return db
      .select({
        usuarioId: usuarioFamilia.usuarioId,
        familiaId: usuarioFamilia.familiaId,
        role: usuarioFamilia.role,
        dataEntrada: usuarioFamilia.dataEntrada,
      })
      .from(usuarioFamilia)
      .where(eq(usuarioFamilia.familiaId, input.familiaId));
  }

  async removeMember(input: { familiaId: string; usuarioId: string }): Promise<boolean> {
    const deleted = await db
      .delete(usuarioFamilia)
      .where(
        and(
          eq(usuarioFamilia.familiaId, input.familiaId),
          eq(usuarioFamilia.usuarioId, input.usuarioId),
        ),
      )
      .returning({ usuarioId: usuarioFamilia.usuarioId });

    return deleted.length > 0;
  }

  async deleteFamily(input: { familiaId: string }): Promise<boolean> {
    const result = await db
      .update(familias)
      .set({ deletedAt: new Date() })
      .where(eq(familias.id, input.familiaId))
      .returning({ id: familias.id });
    return result.length > 0;
  }

  async buscarPorNome(nome: string): Promise<Array<{ id: string; nome: string }>> {
    return db
      .select({ id: familias.id, nome: familias.nome })
      .from(familias)
      .where(and(ilike(familias.nome, `%${nome}%`), isNull(familias.deletedAt)))
      .limit(20);
  }
}

export class InMemoryFamiliaRepository implements FamiliaRepository {
  private familiasById = new Map<string, CreatedFamilia>();
  private membershipsByFamiliaId = new Map<
    string,
    Map<string, { role: 'admin' | 'membro'; dataEntrada: Date }>
  >();
  private invitesById = new Map<string, CreatedFamiliaInvite>();
  private joinRequestsById = new Map<string, CreatedFamiliaJoinRequest>();

  async createWithAdminMembership(input: CreateFamiliaInput): Promise<CreatedFamilia> {
    const id = randomUUID();
    const now = new Date();
    const familia: CreatedFamilia = {
      id,
      nome: input.nome,
      dataCriacao: now,
    };

    this.familiasById.set(id, familia);
    this.membershipsByFamiliaId.set(
      id,
      new Map([[input.usuarioId, { role: 'admin', dataEntrada: now }]]),
    );
    return familia;
  }

  async isUserAdmin(input: { familiaId: string; usuarioId: string }): Promise<boolean> {
    const memberships = this.membershipsByFamiliaId.get(input.familiaId);
    if (!memberships) {
      return false;
    }

    return memberships.get(input.usuarioId)?.role === 'admin';
  }

  async hasMembership(input: { familiaId: string; usuarioId: string }): Promise<boolean> {
    const memberships = this.membershipsByFamiliaId.get(input.familiaId);
    if (!memberships) {
      return false;
    }

    return memberships.has(input.usuarioId);
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

    const existingMembership = memberships.get(input.usuarioId);
    memberships.set(input.usuarioId, {
      role: 'membro',
      dataEntrada: existingMembership?.dataEntrada ?? now,
    });
    this.invitesById.delete(invite.id);

    return this.familiasById.get(invite.familiaId) ?? null;
  }

  async requestJoin(input: RequestFamiliaJoinInput): Promise<CreatedFamiliaJoinRequest> {
    const joinRequest: CreatedFamiliaJoinRequest = {
      id: randomUUID(),
      familiaId: input.familiaId,
      usuarioId: input.usuarioId,
      status: 'pendente',
      solicitadoEm: new Date(),
    };

    this.joinRequestsById.set(joinRequest.id, joinRequest);
    return joinRequest;
  }

  async listPendingJoinRequests(input: {
    familiaId: string;
  }): Promise<CreatedFamiliaJoinRequest[]> {
    return Array.from(this.joinRequestsById.values()).filter(
      (request) => request.familiaId === input.familiaId && request.status === 'pendente',
    );
  }

  async reviewJoinRequest(input: {
    solicitacaoId: string;
    familiaId: string;
    adminId: string;
    acao: 'aprovar' | 'rejeitar';
  }): Promise<ReviewedFamiliaJoinRequest | null> {
    const request = this.joinRequestsById.get(input.solicitacaoId);
    if (!request || request.familiaId !== input.familiaId || request.status !== 'pendente') {
      return null;
    }

    const reviewedStatus = input.acao === 'aprovar' ? 'aprovada' : 'rejeitada';
    const reviewedAt = new Date();
    const reviewed: ReviewedFamiliaJoinRequest = {
      id: request.id,
      familiaId: request.familiaId,
      usuarioId: request.usuarioId,
      status: reviewedStatus,
      solicitadoEm: request.solicitadoEm,
      respondidoEm: reviewedAt,
      respondidoPor: input.adminId,
    };

    this.joinRequestsById.set(request.id, {
      ...request,
      status: reviewedStatus,
      respondidoEm: reviewedAt,
      respondidoPor: input.adminId,
    });

    if (reviewedStatus === 'aprovada') {
      const memberships = this.membershipsByFamiliaId.get(request.familiaId);
      const existingMembership = memberships?.get(request.usuarioId);
      memberships?.set(request.usuarioId, {
        role: 'membro',
        dataEntrada: existingMembership?.dataEntrada ?? reviewedAt,
      });
    }

    return reviewed;
  }

  async listMembers(input: { familiaId: string }) {
    const memberships = this.membershipsByFamiliaId.get(input.familiaId);
    if (!memberships) {
      return [];
    }

    return Array.from(memberships.entries()).map(([usuarioId, membership]) => ({
      usuarioId,
      familiaId: input.familiaId,
      role: membership.role,
      dataEntrada: membership.dataEntrada,
    }));
  }

  async removeMember(input: { familiaId: string; usuarioId: string }): Promise<boolean> {
    const memberships = this.membershipsByFamiliaId.get(input.familiaId);
    if (!memberships) {
      return false;
    }

    return memberships.delete(input.usuarioId);
  }

  async deleteFamily(input: { familiaId: string }): Promise<boolean> {
    const existed = this.familiasById.delete(input.familiaId);
    this.membershipsByFamiliaId.delete(input.familiaId);

    for (const [inviteId, invite] of this.invitesById.entries()) {
      if (invite.familiaId === input.familiaId) {
        this.invitesById.delete(inviteId);
      }
    }

    for (const [requestId, joinRequest] of this.joinRequestsById.entries()) {
      if (joinRequest.familiaId === input.familiaId) {
        this.joinRequestsById.delete(requestId);
      }
    }

    return existed;
  }

  async buscarPorNome(nome: string): Promise<Array<{ id: string; nome: string }>> {
    const lower = nome.toLowerCase();
    return Array.from(this.familiasById.values())
      .filter((f) => f.nome.toLowerCase().includes(lower))
      .map((f) => ({ id: f.id, nome: f.nome }))
      .slice(0, 20);
  }
}
