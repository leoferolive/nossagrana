import { randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DrizzleConviteCriador } from '../../modules/familia/familia-convite-criacao.repository.js';
import { DrizzleFamiliaExclusao } from '../../modules/familia/familia-exclusao.repository.js';
import { esperandoLock } from './pg-cofrinho.js';
import {
  aplicarMigrations,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Criação de convite x exclusão de família no PostgreSQL real (#66, follow-up
 * do review do PR #146). O INSERT do convite só toma lock de chave na linha da
 * família (FK), que NÃO conflita com o UPDATE de `deleted_at`: sem coordenação,
 * um convite inserido depois do `UPDATE convites` da exclusão sobrevive e
 * ressuscita se a família for restaurada. Cada "requisição" usa uma conexão
 * própria com o adapter de PRODUÇÃO; o caso "criação primeiro" segura o INSERT
 * do convite num advisory lock (trigger) para forçar o intercalamento.
 */
const RODADAS = [1, 2, 3, 4, 5];
const ESPERA_PARA_EXCLUSAO_TENTAR_MS = 300;

interface Cenario {
  familiaId: string;
  adminId: string;
}

describe('Criação de convite x exclusão de família no PostgreSQL', () => {
  let banco: BancoDescartavel;
  let observador: postgres.Sql;
  const conexoes: postgres.Sql[] = [];

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    observador = conectar(banco.url);
  });

  afterAll(async () => {
    await Promise.all([observador?.end(), ...conexoes.map((c) => c.end())]);
    await banco?.descartar();
  });

  /** Nova sessão independente com o wiring de produção de criação e de exclusão. */
  function novaSessao() {
    const conexao = conectar(banco.url);
    conexoes.push(conexao);
    const executor = drizzle(conexao);
    return {
      criador: new DrizzleConviteCriador(executor),
      exclusao: new DrizzleFamiliaExclusao(executor),
    };
  }

  async function semearFamilia(nome: string): Promise<Cenario> {
    const [admin] = await banco.sql`INSERT INTO users (nome, email, senha_hash)
      VALUES (${nome}, ${`${nome}-${randomUUID()}@example.com`}, 'hash') RETURNING id`;
    const [familia] = await banco.sql`INSERT INTO familias (nome) VALUES (${nome}) RETURNING id`;
    const adminId = admin!.id as string;
    const familiaId = familia!.id as string;
    await banco.sql`INSERT INTO usuario_familia (usuario_id, familia_id, role)
      VALUES (${adminId}, ${familiaId}, 'admin')`;
    return { familiaId, adminId };
  }

  /** Convites ainda utilizáveis (livres e não expirados) da família, lidos por outra conexão. */
  async function convitesPendentes(familiaId: string): Promise<number> {
    const [linha] = await observador`SELECT count(*)::int AS n FROM convites
      WHERE familia_id = ${familiaId} AND usado_por IS NULL AND expira_em > now()`;
    return linha?.n as number;
  }

  async function totalDeConvites(familiaId: string): Promise<number> {
    const [linha] = await observador`SELECT count(*)::int AS n FROM convites
      WHERE familia_id = ${familiaId}`;
    return linha?.n as number;
  }

  /** O INSERT de convites desta família espera o advisory lock da própria família. */
  async function pausarInsertsDeConvite(familiaId: string): Promise<void> {
    const sufixo = familiaId.replaceAll('-', '');
    await banco.sql.unsafe(`
      CREATE FUNCTION espera_convite_${sufixo}() RETURNS trigger AS $$
      BEGIN
        PERFORM pg_advisory_lock(hashtext('${familiaId}'));
        PERFORM pg_advisory_unlock(hashtext('${familiaId}'));
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER espera_convite BEFORE INSERT ON convites
        FOR EACH ROW WHEN (NEW.familia_id = '${familiaId}')
        EXECUTE FUNCTION espera_convite_${sufixo}();`);
  }

  it('exclusão em andamento: o convite pedido depois NÃO é criado (família excluída)', async () => {
    const cenario = await semearFamilia('ExclusaoPrimeiro');
    const { criador } = novaSessao();
    let criacao!: Promise<unknown>;

    await banco.sql.begin(async (tx) => {
      await tx.unsafe('UPDATE familias SET deleted_at = now() WHERE id = $1', [cenario.familiaId]);
      criacao = criador.criar({ familiaId: cenario.familiaId, criadoPor: cenario.adminId });
      await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
    });

    expect(await criacao).toBeNull();
    expect(await totalDeConvites(cenario.familiaId)).toBe(0);
  });

  it('criação em andamento: a exclusão que chega no meio expira o convite recém-criado', async () => {
    const cenario = await semearFamilia('CriacaoPrimeiro');
    await pausarInsertsDeConvite(cenario.familiaId);
    const { criador } = novaSessao();
    const { exclusao } = novaSessao();
    await observador`SELECT pg_advisory_lock(hashtext(${cenario.familiaId}))`;

    const criacao = criador.criar({ familiaId: cenario.familiaId, criadoPor: cenario.adminId });
    await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
    const exclusaoEmCurso = exclusao.excluir({ familiaId: cenario.familiaId });
    await new Promise((resolve) => setTimeout(resolve, ESPERA_PARA_EXCLUSAO_TENTAR_MS));
    await observador`SELECT pg_advisory_unlock(hashtext(${cenario.familiaId}))`;

    expect(await criacao).not.toBeNull();
    expect(await exclusaoEmCurso).toBe(true);
    expect(await totalDeConvites(cenario.familiaId)).toBe(1);
    expect(await convitesPendentes(cenario.familiaId)).toBe(0);
  });

  it.each(RODADAS)(
    'rodada %i: criação e exclusão concorrentes nunca deixam convite pendente',
    async () => {
      const cenario = await semearFamilia('Corrida');
      const { criador } = novaSessao();
      const { exclusao } = novaSessao();

      await Promise.all([
        criador.criar({ familiaId: cenario.familiaId, criadoPor: cenario.adminId }),
        exclusao.excluir({ familiaId: cenario.familiaId }),
      ]);

      expect(await convitesPendentes(cenario.familiaId)).toBe(0);
    },
  );

  it('família ativa: cria o convite normalmente (código de 12 hex)', async () => {
    const cenario = await semearFamilia('Ativa');
    const { criador } = novaSessao();

    const convite = await criador.criar({
      familiaId: cenario.familiaId,
      criadoPor: cenario.adminId,
    });

    expect(convite).toMatchObject({ familiaId: cenario.familiaId, criadoPor: cenario.adminId });
    expect(convite?.codigo).toMatch(/^[0-9A-F]{12}$/);
    expect(await convitesPendentes(cenario.familiaId)).toBe(1);
  });

  it('família já excluída (ou inexistente): retorna null sem criar convite', async () => {
    const cenario = await semearFamilia('JaExcluida');
    await banco.sql`UPDATE familias SET deleted_at = now() WHERE id = ${cenario.familiaId}`;
    const { criador } = novaSessao();

    const excluida = await criador.criar({
      familiaId: cenario.familiaId,
      criadoPor: cenario.adminId,
    });
    expect(excluida).toBeNull();
    expect(await totalDeConvites(cenario.familiaId)).toBe(0);
  });

  it('família restaurada volta a aceitar convites (novos, nunca o antigo)', async () => {
    const cenario = await semearFamilia('Restaurada');
    const { criador, exclusao } = novaSessao();
    await exclusao.excluir({ familiaId: cenario.familiaId });
    await banco.sql`UPDATE familias SET deleted_at = NULL WHERE id = ${cenario.familiaId}`;

    const novo = await criador.criar({ familiaId: cenario.familiaId, criadoPor: cenario.adminId });

    expect(novo).not.toBeNull();
    expect(await convitesPendentes(cenario.familiaId)).toBe(1);
  });

  it('multi-tenant: convite da família A não aparece na família B', async () => {
    const [a, b] = await Promise.all([semearFamilia('TenantA'), semearFamilia('TenantB')]);
    const { criador } = novaSessao();

    await criador.criar({ familiaId: a.familiaId, criadoPor: a.adminId });

    expect(await totalDeConvites(a.familiaId)).toBe(1);
    expect(await totalDeConvites(b.familiaId)).toBe(0);
  });
});
