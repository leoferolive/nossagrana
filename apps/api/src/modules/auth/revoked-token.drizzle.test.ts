import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { DrizzleRevokedTokenRepository } from './revoked-token.repository.js';
import { DrizzleDatabaseFake } from './tests/drizzle-database-fake.js';

function sqlDoConflito(expressao: unknown): string {
  return new PgDialect().sqlToQuery(expressao as SQL).sql;
}

describe('DrizzleRevokedTokenRepository (cliente fake)', () => {
  let database: DrizzleDatabaseFake;
  let repo: DrizzleRevokedTokenRepository;

  beforeEach(() => {
    database = new DrizzleDatabaseFake();
    repo = new DrizzleRevokedTokenRepository(database.comoDatabase());
  });

  it('revokeToken insere o hash com onConflictDoNothing (idempotente)', async () => {
    const expiresAt = new Date('2030-01-01T00:00:00Z');

    await repo.revokeToken('hash-1', expiresAt, 'u1');

    expect(database.escritas).toEqual([
      {
        operacao: 'insert',
        valores: { tokenHash: 'hash-1', expiresAt, userId: 'u1' },
        conflito: 'nothing',
      },
    ]);
  });

  it('revokeAllByUserId faz upsert do marcador global avançando revokedAt', async () => {
    const antes = Date.now();

    await repo.revokeAllByUserId('u1');

    const [escrita] = database.escritas;
    expect(escrita).toBeDefined();
    expect(escrita?.conflito).toBe('update');
    const valores = escrita?.valores ?? {};
    const atualizacao = escrita?.atualizacao ?? {};
    expect(valores.tokenHash).toBe('__compromised__u1');
    expect(valores.userId).toBe('u1');
    const revokedAt = valores.revokedAt as Date;
    expect(revokedAt.getTime()).toBeGreaterThanOrEqual(antes);
    // O UPDATE do conflito é decidido pelo banco (GREATEST), não pelo instante da app:
    // nunca um Date cru, senão uma revogação antiga tardia sobrescreveria a mais nova.
    expect(atualizacao.revokedAt).not.toBeInstanceOf(Date);
    expect(atualizacao.expiresAt).not.toBeInstanceOf(Date);
    expect(sqlDoConflito(atualizacao.revokedAt)).toMatch(/greatest\(.*excluded\.revoked_at\)/i);
    expect(sqlDoConflito(atualizacao.expiresAt)).toMatch(/greatest\(.*excluded\.expires_at\)/i);
    const validadeMs = (valores.expiresAt as Date).getTime() - revokedAt.getTime();
    expect(validadeMs).toBe(365 * 24 * 60 * 60 * 1000);
  });

  it('isRevoked: true quando há linha, false quando não há', async () => {
    database.linhasSelect = [{ id: 'x' }];
    expect(await repo.isRevoked('hash-1')).toBe(true);

    database.linhasSelect = [];
    expect(await repo.isRevoked('hash-1')).toBe(false);
  });

  it('findRevokedAllAt devolve o instante gravado ou null', async () => {
    const revokedAt = new Date('2026-05-01T10:00:00Z');
    database.linhasSelect = [{ revokedAt }];
    expect(await repo.findRevokedAllAt('u1')).toBe(revokedAt);

    database.linhasSelect = [];
    expect(await repo.findRevokedAllAt('u1')).toBeNull();
  });

  it('cleanupExpired devolve a quantidade de linhas removidas', async () => {
    database.linhasDelete = [{ id: 'a' }, { id: 'b' }];

    expect(await repo.cleanupExpired()).toBe(2);
  });
});
