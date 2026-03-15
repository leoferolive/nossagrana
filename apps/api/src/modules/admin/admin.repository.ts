import { eq, isNotNull } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { familias, users } from '../../db/schema.js';
import type { AdminRepository } from './admin.service.js';

export class DrizzleAdminRepository implements AdminRepository {
  async findFamiliaDeleted(
    familiaId: string,
  ): Promise<{ id: string; nome: string; deletedAt: Date } | null> {
    const [row] = await db
      .select({ id: familias.id, nome: familias.nome, deletedAt: familias.deletedAt })
      .from(familias)
      .where(eq(familias.id, familiaId))
      .limit(1);

    if (!row || !row.deletedAt) return null;
    return { id: row.id, nome: row.nome, deletedAt: row.deletedAt };
  }

  async recuperarFamilia(familiaId: string): Promise<boolean> {
    const result = await db
      .update(familias)
      .set({ deletedAt: null })
      .where(eq(familias.id, familiaId))
      .returning({ id: familias.id });
    return result.length > 0;
  }

  async findUserById(
    userId: string,
  ): Promise<{ id: string; email: string; nome?: string } | null> {
    const [user] = await db
      .select({ id: users.id, email: users.email, nome: users.nome })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  }
}

export class InMemoryAdminRepository implements AdminRepository {
  private deletedFamilias = new Map<string, { id: string; nome: string; deletedAt: Date }>();
  private usersMap = new Map<string, { id: string; email: string; nome: string }>();

  seedDeletedFamilia(familia: { id: string; nome: string; deletedAt: Date }) {
    this.deletedFamilias.set(familia.id, familia);
  }

  seedUser(user: { id: string; email: string; nome: string }) {
    this.usersMap.set(user.id, user);
  }

  async findFamiliaDeleted(
    familiaId: string,
  ): Promise<{ id: string; nome: string; deletedAt: Date } | null> {
    return this.deletedFamilias.get(familiaId) ?? null;
  }

  async recuperarFamilia(familiaId: string): Promise<boolean> {
    const exists = this.deletedFamilias.has(familiaId);
    this.deletedFamilias.delete(familiaId);
    return exists;
  }

  async findUserById(
    userId: string,
  ): Promise<{ id: string; email: string; nome?: string } | null> {
    return this.usersMap.get(userId) ?? null;
  }
}
