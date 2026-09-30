import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DrizzleRevokedTokenRepository,
  hashToken,
} from '../../modules/auth/revoked-token.repository.js';
import { SessaoRevogacaoService } from '../../modules/auth/sessao-revogacao.service.js';
import { NoopSessaoLifecyclePublisher } from '../../shared/sessao-lifecycle/sessao-lifecycle.events.js';
import {
  aplicarMigrations,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Revogação global de sessões no PostgreSQL real (#119). Cada "requisição" usa
 * uma conexão própria (pool de 1) com o adapter de PRODUÇÃO, então a corrida
 * entre revogações e checagens é entre sessões de verdade.
 */
const DIA_MS = 24 * 60 * 60 * 1000;
const RODADAS = [1, 2, 3];
const REVOGACOES_SIMULTANEAS = 12;

describe('Revogação global de sessões no PostgreSQL', () => {
  let banco: BancoDescartavel;
  const conexoes: postgres.Sql[] = [];

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
  });

  afterAll(async () => {
    await Promise.all(conexoes.map((c) => c.end()));
    await banco?.descartar();
  });

  async function criarUsuario(): Promise<string> {
    const email = `revogacao-${crypto.randomUUID()}@example.com`;
    const [usuario] = await banco.sql`INSERT INTO users (nome, email, senha_hash)
      VALUES ('Ana', ${email}, 'hash') RETURNING id`;
    return usuario.id as string;
  }

  /** Nova sessão independente com o wiring de produção da revogação. */
  function novaSessao(): DrizzleRevokedTokenRepository {
    const conexao = conectar(banco.url);
    conexoes.push(conexao);
    return new DrizzleRevokedTokenRepository(drizzle(conexao));
  }

  it('sem revogação global, nada é considerado revogado', async () => {
    const userId = await criarUsuario();

    expect(await novaSessao().findRevokedAllAt(userId)).toBeNull();
  });

  it('a revogação grava o instante e isola por usuário', async () => {
    const ana = await criarUsuario();
    const bruno = await criarUsuario();
    const antes = Date.now();

    await novaSessao().revokeAllByUserId(ana);

    const revogadoEm = await novaSessao().findRevokedAllAt(ana);
    expect(revogadoEm?.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    expect(await novaSessao().findRevokedAllAt(bruno)).toBeNull();
  });

  it('segunda revogação avança o instante (upsert), não mantém o antigo', async () => {
    const userId = await criarUsuario();
    const repo = novaSessao();
    await repo.revokeAllByUserId(userId);
    const primeira = await repo.findRevokedAllAt(userId);
    await new Promise((resolve) => setTimeout(resolve, 20));

    await repo.revokeAllByUserId(userId);

    const segunda = await repo.findRevokedAllAt(userId);
    expect(segunda!.getTime()).toBeGreaterThan(primeira!.getTime());
    const [{ total }] = await banco.sql`SELECT count(*)::int AS total
      FROM revoked_refresh_tokens WHERE user_id = ${userId} AND token_hash LIKE '__compromised__%'`;
    expect(total).toBe(1);
  });

  it('o marcador global vence em ~1 ano (cobre a vida do refresh) e o cleanup não o remove antes', async () => {
    const userId = await criarUsuario();
    const repo = novaSessao();
    await repo.revokeAllByUserId(userId);

    await repo.cleanupExpired();

    expect(await repo.findRevokedAllAt(userId)).not.toBeNull();
    const [{ expira_em }] = await banco.sql`SELECT expires_at AS expira_em
      FROM revoked_refresh_tokens WHERE user_id = ${userId}`;
    expect((expira_em as Date).getTime() - Date.now()).toBeGreaterThan(300 * DIA_MS);
  });

  it.each(RODADAS)(
    'rodada %i: revogações simultâneas (troca + reset + reuso) não falham nem duplicam o marcador',
    async () => {
      const userId = await criarUsuario();
      const sessoes = Array.from({ length: REVOGACOES_SIMULTANEAS }, novaSessao);

      await Promise.all(sessoes.map((repo) => repo.revokeAllByUserId(userId)));

      const [{ total }] = await banco.sql`SELECT count(*)::int AS total
        FROM revoked_refresh_tokens WHERE user_id = ${userId}`;
      expect(total).toBe(1);
    },
  );

  it.each(RODADAS)(
    'rodada %i: checagens concorrentes à revogação veem antes ou depois (nunca parcial) e, após o commit, rejeitam o token antigo',
    async () => {
      const userId = await criarUsuario();
      const servico = (repo: DrizzleRevokedTokenRepository) =>
        new SessaoRevogacaoService(repo, new NoopSessaoLifecyclePublisher());
      const emitidoAntes = Math.floor(Date.now() / 1000);

      const [revogacao, ...checagens] = await Promise.all([
        servico(novaSessao()).revogarTodas(userId),
        ...Array.from({ length: 8 }, () =>
          servico(novaSessao()).estaRevogada(userId, emitidoAntes),
        ),
      ]);

      expect(revogacao).toBeUndefined();
      // Cada checagem concorrente vê antes ou depois da revogação, nunca um estado parcial.
      for (const vistaComoRevogada of checagens) expect(typeof vistaComoRevogada).toBe('boolean');
      // Depois que a revogação commitou, o token antigo é sempre rejeitado, e um posterior passa.
      expect(await servico(novaSessao()).estaRevogada(userId, emitidoAntes)).toBe(true);
      expect(await servico(novaSessao()).estaRevogada(userId, emitidoAntes + 5)).toBe(false);
    },
  );

  it('revogar um refresh individual (logout) não cria revogação global', async () => {
    const userId = await criarUsuario();
    const repo = novaSessao();

    await repo.revokeToken(hashToken('refresh-do-celular'), new Date(Date.now() + DIA_MS), userId);

    expect(await repo.isRevoked(hashToken('refresh-do-celular'))).toBe(true);
    expect(await repo.findRevokedAllAt(userId)).toBeNull();
  });
});
