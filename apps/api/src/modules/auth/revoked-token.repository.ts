import { createHash } from 'node:crypto';

import { eq, lte } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { revokedRefreshTokens } from '../../db/schema.js';

export interface RevokedTokenRepository {
  revokeToken(tokenHash: string, expiresAt: Date, userId: string): Promise<void>;
  revokeAllByUserId(userId: string): Promise<void>;
  isRevoked(tokenHash: string): Promise<boolean>;
  /** Instante da última revogação global do usuário, ou null se nunca houve (#119). */
  findRevokedAllAt(userId: string): Promise<Date | null>;
  cleanupExpired(): Promise<number>;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function marcadorDeRevogacaoGlobal(userId: string): string {
  return `__compromised__${userId}`;
}

export class DrizzleRevokedTokenRepository implements RevokedTokenRepository {
  /** Recebe o cliente Drizzle (`db` em produção; conexão própria nos testes contra PostgreSQL real). */
  constructor(private readonly database: PostgresJsDatabase) {}

  async revokeToken(tokenHash: string, expiresAt: Date, userId: string): Promise<void> {
    await this.database
      .insert(revokedRefreshTokens)
      .values({ tokenHash, expiresAt, userId })
      .onConflictDoNothing({ target: revokedRefreshTokens.tokenHash });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    const agora = new Date();
    const expiresAt = new Date(agora.getTime() + 365 * 24 * 60 * 60 * 1000);
    // Upsert: cada revogação avança `revokedAt`. Com DoNothing, uma 2ª revogação (ex.:
    // reset depois de troca de senha) manteria o instante antigo e deixaria de matar
    // sessões criadas entre as duas.
    await this.database
      .insert(revokedRefreshTokens)
      .values({ tokenHash: marcadorDeRevogacaoGlobal(userId), expiresAt, userId, revokedAt: agora })
      .onConflictDoUpdate({
        target: revokedRefreshTokens.tokenHash,
        set: { revokedAt: agora, expiresAt },
      });
  }

  async isRevoked(tokenHash: string): Promise<boolean> {
    const [found] = await this.database
      .select({ id: revokedRefreshTokens.id })
      .from(revokedRefreshTokens)
      .where(eq(revokedRefreshTokens.tokenHash, tokenHash))
      .limit(1);

    return !!found;
  }

  async findRevokedAllAt(userId: string): Promise<Date | null> {
    const [marcador] = await this.database
      .select({ revokedAt: revokedRefreshTokens.revokedAt })
      .from(revokedRefreshTokens)
      .where(eq(revokedRefreshTokens.tokenHash, marcadorDeRevogacaoGlobal(userId)))
      .limit(1);

    return marcador?.revokedAt ?? null;
  }

  async cleanupExpired(): Promise<number> {
    const deleted = await this.database
      .delete(revokedRefreshTokens)
      .where(lte(revokedRefreshTokens.expiresAt, new Date()))
      .returning({ id: revokedRefreshTokens.id });

    return deleted.length;
  }
}

export class InMemoryRevokedTokenRepository implements RevokedTokenRepository {
  private tokens = new Map<string, { expiresAt: Date; revokedAt: Date; userId: string }>();
  private revokedAllAt = new Map<string, Date>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async revokeToken(tokenHash: string, expiresAt: Date, userId: string): Promise<void> {
    if (!this.tokens.has(tokenHash)) {
      this.tokens.set(tokenHash, { expiresAt, revokedAt: this.now(), userId });
    }
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    this.revokedAllAt.set(userId, this.now());
  }

  async isRevoked(tokenHash: string): Promise<boolean> {
    return this.tokens.has(tokenHash);
  }

  async findRevokedAllAt(userId: string): Promise<Date | null> {
    return this.revokedAllAt.get(userId) ?? null;
  }

  async cleanupExpired(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const [hash, { expiresAt }] of this.tokens.entries()) {
      if (expiresAt <= now) {
        this.tokens.delete(hash);
        count++;
      }
    }
    return count;
  }
}
