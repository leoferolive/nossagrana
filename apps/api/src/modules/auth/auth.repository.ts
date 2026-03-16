import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { db } from '../../db/client.js';
import {
  categorias,
  convites,
  familias,
  metodosPagamento,
  orcamentoCategoria,
  snapshotsMensais,
  solicitacoesEntrada,
  transacoes,
  usuarioFamilia,
  users,
} from '../../db/schema.js';
import type { AuthRepository, AuthRepositoryUser } from './auth.types.js';

export class DrizzleAuthRepository implements AuthRepository {
  async findByEmail(email: string): Promise<AuthRepositoryUser | null> {
    const [user] = await db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        senhaHash: users.senhaHash,
        dataCriacao: users.dataCriacao,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
  }

  async findById(id: string): Promise<AuthRepositoryUser | null> {
    const [user] = await db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        senhaHash: users.senhaHash,
        dataCriacao: users.dataCriacao,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ?? null;
  }

  async updateNome(id: string, nome: string): Promise<AuthRepositoryUser> {
    const [user] = await db.update(users).set({ nome }).where(eq(users.id, id)).returning({
      id: users.id,
      nome: users.nome,
      email: users.email,
      senhaHash: users.senhaHash,
      dataCriacao: users.dataCriacao,
    });
    return user;
  }

  async updateSenhaHash(id: string, senhaHash: string): Promise<void> {
    await db.update(users).set({ senhaHash }).where(eq(users.id, id));
  }

  async createUser(input: {
    nome: string;
    email: string;
    senhaHash: string;
  }): Promise<AuthRepositoryUser> {
    const [user] = await db
      .insert(users)
      .values({
        nome: input.nome,
        email: input.email,
        senhaHash: input.senhaHash,
      })
      .returning({
        id: users.id,
        nome: users.nome,
        email: users.email,
        senhaHash: users.senhaHash,
        dataCriacao: users.dataCriacao,
      });

    return user;
  }

  async findFamiliasByUserId(userId: string): Promise<Array<{ familiaId: string }>> {
    return db
      .select({ familiaId: usuarioFamilia.familiaId })
      .from(usuarioFamilia)
      .where(eq(usuarioFamilia.usuarioId, userId));
  }

  async countFamiliaMembers(familiaId: string): Promise<number> {
    const rows = await db
      .select({ usuarioId: usuarioFamilia.usuarioId })
      .from(usuarioFamilia)
      .where(eq(usuarioFamilia.familiaId, familiaId));
    return rows.length;
  }

  async deleteFamiliaAndAllData(familiaId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(orcamentoCategoria).where(eq(orcamentoCategoria.familiaId, familiaId));
      await tx.delete(transacoes).where(eq(transacoes.familiaId, familiaId));
      await tx.delete(snapshotsMensais).where(eq(snapshotsMensais.familiaId, familiaId));
      await tx.delete(metodosPagamento).where(eq(metodosPagamento.familiaId, familiaId));
      await tx.delete(categorias).where(eq(categorias.familiaId, familiaId));
      await tx.delete(solicitacoesEntrada).where(eq(solicitacoesEntrada.familiaId, familiaId));
      await tx.delete(convites).where(eq(convites.familiaId, familiaId));
      await tx.delete(usuarioFamilia).where(eq(usuarioFamilia.familiaId, familiaId));
      await tx.delete(familias).where(eq(familias.id, familiaId));
    });
  }

  async removeUserFromFamilia(userId: string, familiaId: string): Promise<void> {
    await db
      .delete(usuarioFamilia)
      .where(and(eq(usuarioFamilia.usuarioId, userId), eq(usuarioFamilia.familiaId, familiaId)));
  }

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }
}

export class InMemoryAuthRepository implements AuthRepository {
  private usersByEmail = new Map<string, AuthRepositoryUser>();
  private usersById = new Map<string, AuthRepositoryUser>();
  private familiasByUserId = new Map<string, Set<string>>();
  private memberCountByFamiliaId = new Map<string, number>();

  async findByEmail(email: string): Promise<AuthRepositoryUser | null> {
    return this.usersByEmail.get(email) ?? null;
  }

  async findById(id: string): Promise<AuthRepositoryUser | null> {
    return this.usersById.get(id) ?? null;
  }

  async updateNome(id: string, nome: string): Promise<AuthRepositoryUser> {
    const user = this.usersById.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, nome };
    this.usersById.set(id, updated);
    this.usersByEmail.set(updated.email, updated);
    return updated;
  }

  async updateSenhaHash(id: string, senhaHash: string): Promise<void> {
    const user = this.usersById.get(id);
    if (!user) throw new Error('User not found');
    const updated = { ...user, senhaHash };
    this.usersById.set(id, updated);
    this.usersByEmail.set(updated.email, updated);
  }

  async createUser(input: {
    nome: string;
    email: string;
    senhaHash: string;
  }): Promise<AuthRepositoryUser> {
    const id = randomUUID();
    const now = new Date();
    const user: AuthRepositoryUser = {
      id,
      nome: input.nome,
      email: input.email,
      senhaHash: input.senhaHash,
      dataCriacao: now,
    };
    this.usersByEmail.set(input.email, user);
    this.usersById.set(id, user);
    return user;
  }

  async findFamiliasByUserId(userId: string): Promise<Array<{ familiaId: string }>> {
    const familias = this.familiasByUserId.get(userId);
    if (!familias) return [];
    return Array.from(familias).map((familiaId) => ({ familiaId }));
  }

  async countFamiliaMembers(familiaId: string): Promise<number> {
    return this.memberCountByFamiliaId.get(familiaId) ?? 0;
  }

  async deleteFamiliaAndAllData(familiaId: string): Promise<void> {
    this.memberCountByFamiliaId.delete(familiaId);
    for (const [userId, familias] of this.familiasByUserId.entries()) {
      familias.delete(familiaId);
      if (familias.size === 0) {
        this.familiasByUserId.delete(userId);
      }
    }
  }

  async removeUserFromFamilia(userId: string, familiaId: string): Promise<void> {
    const familias = this.familiasByUserId.get(userId);
    if (familias) {
      familias.delete(familiaId);
    }
    const count = this.memberCountByFamiliaId.get(familiaId);
    if (count !== undefined && count > 0) {
      this.memberCountByFamiliaId.set(familiaId, count - 1);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.usersById.get(userId);
    if (user) {
      this.usersByEmail.delete(user.email);
      this.usersById.delete(userId);
    }
    this.familiasByUserId.delete(userId);
  }
}
