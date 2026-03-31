import { and, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { passwordResetTokens } from '../../db/schema.js';

import type { PasswordResetRepository, PasswordResetToken } from './password-reset.types.js';

/* v8 ignore start -- Drizzle repository requires real DB; tested via integration/E2E */
export class DrizzlePasswordResetRepository implements PasswordResetRepository {
  async createToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      expiresAt: row.expiresAt,
      used: row.used,
      createdAt: row.createdAt,
    };
  }

  async markUsed(tokenHash: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
  }

  async deleteUnusedByUserId(userId: string): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, userId), eq(passwordResetTokens.used, false)));
  }
}
/* v8 ignore stop */

export class InMemoryPasswordResetRepository implements PasswordResetRepository {
  private tokens: PasswordResetToken[] = [];
  private idCounter = 0;

  async createToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.idCounter++;
    this.tokens.push({
      id: String(this.idCounter),
      userId,
      tokenHash,
      expiresAt,
      used: false,
      createdAt: new Date(),
    });
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.tokens.find((t) => t.tokenHash === tokenHash) ?? null;
  }

  async markUsed(tokenHash: string): Promise<void> {
    const token = this.tokens.find((t) => t.tokenHash === tokenHash);
    if (token) token.used = true;
  }

  async deleteUnusedByUserId(userId: string): Promise<void> {
    this.tokens = this.tokens.filter((t) => !(t.userId === userId && !t.used));
  }
}
