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
        dataCriacao: users.dataCriacao,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user ?? null;
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
        dataCriacao: users.dataCriacao,
      });

    return user;
  }
}

export class InMemoryAuthRepository implements AuthRepository {
  private usersByEmail = new Map<string, AuthRepositoryUser>();

  async findByEmail(email: string): Promise<AuthRepositoryUser | null> {
    return this.usersByEmail.get(email) ?? null;
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
      dataCriacao: now,
    };
    this.usersByEmail.set(input.email, user);
    return user;
  }
}
