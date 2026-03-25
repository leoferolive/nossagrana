import { createHash } from 'node:crypto';

import { eq, lte } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { revokedRefreshTokens } from '../../db/schema.js';

export interface RevokedTokenRepository {
  revokeToken(tokenHash: string, expiresAt: Date): Promise<void>;
  isRevoked(tokenHash: string): Promise<boolean>;
  cleanupExpired(): Promise<number>;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class DrizzleRevokedTokenRepository implements RevokedTokenRepository {
  async revokeToken(tokenHash: string, expiresAt: Date): Promise<void> {
    await db
      .insert(revokedRefreshTokens)
      .values({ tokenHash, expiresAt })
      .onConflictDoNothing({ target: revokedRefreshTokens.tokenHash });
  }

  async isRevoked(tokenHash: string): Promise<boolean> {
    const [found] = await db
      .select({ id: revokedRefreshTokens.id })
      .from(revokedRefreshTokens)
      .where(eq(revokedRefreshTokens.tokenHash, tokenHash))
      .limit(1);

    return !!found;
  }

  async cleanupExpired(): Promise<number> {
    const deleted = await db
      .delete(revokedRefreshTokens)
      .where(lte(revokedRefreshTokens.expiresAt, new Date()))
      .returning({ id: revokedRefreshTokens.id });

    return deleted.length;
  }
}

export class InMemoryRevokedTokenRepository implements RevokedTokenRepository {
  private tokens = new Map<string, { expiresAt: Date; revokedAt: Date }>();

  async revokeToken(tokenHash: string, expiresAt: Date): Promise<void> {
    if (!this.tokens.has(tokenHash)) {
      this.tokens.set(tokenHash, { expiresAt, revokedAt: new Date() });
    }
  }

  async isRevoked(tokenHash: string): Promise<boolean> {
    return this.tokens.has(tokenHash);
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
