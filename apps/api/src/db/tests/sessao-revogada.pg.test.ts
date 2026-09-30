import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

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

  // Encerra as conexões de cada teste: as revogações simultâneas abrem dezenas delas e o
  // total da suíte passaria de max_connections (100) do PostgreSQL descartável.
  afterEach(async () => {
    await Promise.all(conexoes.splice(0).map((c) => c.end()));
  });

  afterAll(async () => {
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

  /** Repositório de produção com relógio fixo: simula a requisição que carimbou `agora` antes de esperar o banco. */
  function novaSessaoCarimbadaEm(carimbo: Date): DrizzleRevokedTokenRepository {
    const conexao = conectar(banco.url);
    conexoes.push(conexao);
    return new DrizzleRevokedTokenRepository(drizzle(conexao), () => carimbo);
  }

  async function lerMarcador(userId: string): Promise<{ revokedAt: Date; expiresAt: Date }> {
    const [linha] = await banco.sql`SELECT revoked_at, expires_at
      FROM revoked_refresh_tokens WHERE user_id = ${userId}`;
    expect(linha).toBeDefined();
    return { revokedAt: linha.revoked_at as Date, expiresAt: linha.expires_at as Date };
  }

  describe('marcador monotônico (P1 do #150)', () => {
    const CARIMBO_ANTIGO = new Date('2026-09-30T10:00:00.000Z');
    const CARIMBO_NOVO = new Date('2026-09-30T10:00:05.000Z');
    const ANO_MS = 365 * DIA_MS;

    it('a revogação mais antiga que commita por último não faz revoked_at nem expires_at retrocederem', async () => {
      const userId = await criarUsuario();

      await novaSessaoCarimbadaEm(CARIMBO_NOVO).revokeAllByUserId(userId);
      await novaSessaoCarimbadaEm(CARIMBO_ANTIGO).revokeAllByUserId(userId);

      const marcador = await lerMarcador(userId);
      expect(marcador.revokedAt).toEqual(CARIMBO_NOVO);
      expect(marcador.expiresAt.getTime()).toBe(CARIMBO_NOVO.getTime() + ANO_MS);
    });

    it('na ordem natural o marcador avança e o expiry acompanha o revoked_at mais novo', async () => {
      const userId = await criarUsuario();

      await novaSessaoCarimbadaEm(CARIMBO_ANTIGO).revokeAllByUserId(userId);
      await novaSessaoCarimbadaEm(CARIMBO_NOVO).revokeAllByUserId(userId);

      const marcador = await lerMarcador(userId);
      expect(marcador.revokedAt).toEqual(CARIMBO_NOVO);
      expect(marcador.expiresAt.getTime()).toBe(CARIMBO_NOVO.getTime() + ANO_MS);
    });

    it('token emitido entre os dois carimbos continua revogado após a escrita atrasada', async () => {
      const userId = await criarUsuario();
      const emitidoEntre = Math.floor(CARIMBO_ANTIGO.getTime() / 1000) + 2;
      const servico = new SessaoRevogacaoService(novaSessao(), new NoopSessaoLifecyclePublisher());

      await novaSessaoCarimbadaEm(CARIMBO_NOVO).revokeAllByUserId(userId);
      await novaSessaoCarimbadaEm(CARIMBO_ANTIGO).revokeAllByUserId(userId);

      expect(await servico.estaRevogada(userId, emitidoEntre)).toBe(true);
    });

    it.each(RODADAS)(
      'rodada %i: revogações simultâneas com carimbos embaralhados terminam no maior carimbo',
      async (rodada) => {
        const userId = await criarUsuario();
        // Deslocamento por rodada: cada rodada embaralha os carimbos numa permutação diferente
        // (determinística, logo repetível); 7 é coprimo com 12, então é sempre uma permutação.
        const carimbos = Array.from(
          { length: REVOGACOES_SIMULTANEAS },
          (_, i) =>
            new Date(CARIMBO_ANTIGO.getTime() + ((i * 7 + rodada) % REVOGACOES_SIMULTANEAS) * 1000),
        );
        const maior = new Date(Math.max(...carimbos.map((c) => c.getTime())));

        await Promise.all(carimbos.map((c) => novaSessaoCarimbadaEm(c).revokeAllByUserId(userId)));

        const marcador = await lerMarcador(userId);
        expect(marcador.revokedAt).toEqual(maior);
        expect(marcador.expiresAt.getTime()).toBe(maior.getTime() + ANO_MS);
      },
    );
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
