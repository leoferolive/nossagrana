import { createHash } from 'node:crypto';

import { eq, lte, sql } from 'drizzle-orm';
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

/**
 * Validade do marcador global = `revoked_at` + 1 ano. Precisa cobrir a vida máxima dos
 * tokens que ele invalida (refresh de 7 dias) com folga; o cleanup só o remove depois.
 */
const VALIDADE_MARCADOR_GLOBAL_MS = 365 * 24 * 60 * 60 * 1000;

function marcadorDeRevogacaoGlobal(userId: string): string {
  return `__compromised__${userId}`;
}

export class DrizzleRevokedTokenRepository implements RevokedTokenRepository {
  /**
   * Recebe o cliente Drizzle (`db` em produção; conexão própria nos testes contra PostgreSQL real)
   * e o relógio (injetável para simular requisições cujo carimbo chega fora de ordem).
   */
  constructor(
    private readonly database: PostgresJsDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async revokeToken(tokenHash: string, expiresAt: Date, userId: string): Promise<void> {
    await this.database
      .insert(revokedRefreshTokens)
      .values({ tokenHash, expiresAt, userId })
      .onConflictDoNothing({ target: revokedRefreshTokens.tokenHash });
  }

  /**
   * Upsert MONOTÔNICO do instante de revogação global. A requisição carimba `agora` antes de
   * esperar o banco, então uma mais antiga pode commitar depois de uma mais nova (P1 do #150).
   * Por isso o conflito resolve com GREATEST(existente, novo) em `revoked_at` e `expires_at`:
   * o marcador nunca retrocede e o expiry (= `revoked_at` + 1 ano, crescente com ele) sempre
   * acompanha o maior `revoked_at`. SQL raw necessário: o Drizzle não expõe GREATEST.
   * Não é DoNothing: uma 2ª revogação (ex.: reset depois de troca de senha) manteria o instante
   * antigo e deixaria de matar sessões criadas entre as duas.
   */
  async revokeAllByUserId(userId: string): Promise<void> {
    const agora = this.now();
    const expiresAt = new Date(agora.getTime() + VALIDADE_MARCADOR_GLOBAL_MS);
    await this.database
      .insert(revokedRefreshTokens)
      .values({ tokenHash: marcadorDeRevogacaoGlobal(userId), expiresAt, userId, revokedAt: agora })
      .onConflictDoUpdate({
        target: revokedRefreshTokens.tokenHash,
        set: {
          revokedAt: sql`greatest(${revokedRefreshTokens.revokedAt}, excluded.revoked_at)`,
          expiresAt: sql`greatest(${revokedRefreshTokens.expiresAt}, excluded.expires_at)`,
        },
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
    const agora = this.now();
    const atual = this.revokedAllAt.get(userId);
    // Monotônico como o GREATEST do adapter Drizzle: revogação atrasada nunca retrocede o marcador.
    if (atual && atual >= agora) return;
    this.revokedAllAt.set(userId, agora);
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
