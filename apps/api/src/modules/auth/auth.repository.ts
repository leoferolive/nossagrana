import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';
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
}

export class InMemoryAuthRepository implements AuthRepository {
  private usersByEmail = new Map<string, AuthRepositoryUser>();
  private usersById = new Map<string, AuthRepositoryUser>();

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
}
