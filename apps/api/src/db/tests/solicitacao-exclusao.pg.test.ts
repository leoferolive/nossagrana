import { randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DrizzleFamiliaExclusao } from '../../modules/familia/familia-exclusao.repository.js';
import { DrizzleSolicitacaoEntrada } from '../../modules/familia/familia-solicitacao.repository.js';
import { esperandoLock } from './pg-cofrinho.js';
import {
  aplicarMigrations,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Solicitação/aprovação de entrada x exclusão de família no PostgreSQL real
 * (#149, mesma classe de corrida de #66/#147). Sem coordenação, uma solicitação
 * criada ou aprovada depois do `UPDATE familias SET deleted_at` entra numa
 * família excluída e reaparece se ela for restaurada. Cada "requisição" usa
 * uma conexão própria com os adapters de PRODUÇÃO.
 */
const RODADAS = [1, 2, 3, 4, 5];

interface Cenario {
  familiaId: string;
  adminId: string;
  solicitanteId: string;
}

describe('Solicitação de entrada x exclusão de família no PostgreSQL', () => {
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

  function novaSessao() {
    const conexao = conectar(banco.url);
    conexoes.push(conexao);
    const executor = drizzle(conexao);
    return {
      solicitacoes: new DrizzleSolicitacaoEntrada(executor),
      exclusao: new DrizzleFamiliaExclusao(executor),
    };
  }

  async function semearUsuario(nome: string): Promise<string> {
    const [linha] = await banco.sql`INSERT INTO users (nome, email, senha_hash)
      VALUES (${nome}, ${`${nome}-${randomUUID()}@example.com`}, 'hash') RETURNING id`;
    return linha!.id as string;
  }

  async function semearFamilia(nome: string): Promise<Cenario> {
    const adminId = await semearUsuario(nome);
    const solicitanteId = await semearUsuario(`${nome}-solicitante`);
    const [familia] = await banco.sql`INSERT INTO familias (nome) VALUES (${nome}) RETURNING id`;
    const familiaId = familia!.id as string;
    await banco.sql`INSERT INTO usuario_familia (usuario_id, familia_id, role)
      VALUES (${adminId}, ${familiaId}, 'admin')`;
    return { familiaId, adminId, solicitanteId };
  }

  async function semearPendente(c: Cenario): Promise<string> {
    const [linha] = await banco.sql`INSERT INTO solicitacoes_entrada (familia_id, usuario_id)
      VALUES (${c.familiaId}, ${c.solicitanteId}) RETURNING id`;
    return linha!.id as string;
  }

  async function totalDeSolicitacoes(familiaId: string): Promise<number> {
    const [linha] = await observador`SELECT count(*)::int AS n FROM solicitacoes_entrada
      WHERE familia_id = ${familiaId}`;
    return linha?.n as number;
  }

  async function ehMembro(c: Cenario): Promise<boolean> {
    const [linha] = await observador`SELECT count(*)::int AS n FROM usuario_familia
      WHERE familia_id = ${c.familiaId} AND usuario_id = ${c.solicitanteId}`;
    return linha?.n === 1;
  }

  async function statusDa(id: string): Promise<string> {
    const [linha] = await observador`SELECT status FROM solicitacoes_entrada WHERE id = ${id}`;
    return linha?.status as string;
  }

  it('solicitar: exclusão em andamento, a solicitação pedida depois NÃO é criada', async () => {
    const c = await semearFamilia('SolicitarExclusaoPrimeiro');
    const { solicitacoes } = novaSessao();
    let pedido!: Promise<unknown>;

    await banco.sql.begin(async (tx) => {
      await tx.unsafe('UPDATE familias SET deleted_at = now() WHERE id = $1', [c.familiaId]);
      pedido = solicitacoes.solicitar({ familiaId: c.familiaId, usuarioId: c.solicitanteId });
      await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
    });

    expect(await pedido).toBeNull();
    expect(await totalDeSolicitacoes(c.familiaId)).toBe(0);
  });

  it('revisar: exclusão em andamento, a aprovação feita depois NÃO vincula o membro', async () => {
    const c = await semearFamilia('AprovarExclusaoPrimeiro');
    const solicitacaoId = await semearPendente(c);
    const { solicitacoes } = novaSessao();
    let aprovacao!: Promise<unknown>;

    await banco.sql.begin(async (tx) => {
      await tx.unsafe('UPDATE familias SET deleted_at = now() WHERE id = $1', [c.familiaId]);
      aprovacao = solicitacoes.revisar({
        solicitacaoId,
        familiaId: c.familiaId,
        adminId: c.adminId,
        acao: 'aprovar',
      });
      await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
    });

    expect(await aprovacao).toBeNull();
    expect(await ehMembro(c)).toBe(false);
    expect(await statusDa(solicitacaoId)).toBe('pendente');
  });

  it.each(RODADAS)(
    'rodada %i: aprovação e exclusão concorrentes nunca deixam membro novo em família excluída sem a aprovação ter ocorrido antes',
    async () => {
      const c = await semearFamilia('CorridaAprovar');
      const solicitacaoId = await semearPendente(c);
      const { solicitacoes } = novaSessao();
      const { exclusao } = novaSessao();

      const [aprovada] = await Promise.all([
        solicitacoes.revisar({
          solicitacaoId,
          familiaId: c.familiaId,
          adminId: c.adminId,
          acao: 'aprovar',
        }),
        exclusao.excluir({ familiaId: c.familiaId }),
      ]);

      // Resultado consistente: membro vinculado se, e somente se, a solicitação foi aprovada.
      expect(await ehMembro(c)).toBe(aprovada !== null);
      expect(await statusDa(solicitacaoId)).toBe(aprovada ? 'aprovada' : 'pendente');
    },
  );

  it('família ativa: solicita e aprova normalmente', async () => {
    const c = await semearFamilia('Ativa');
    const { solicitacoes } = novaSessao();

    const criada = await solicitacoes.solicitar({
      familiaId: c.familiaId,
      usuarioId: c.solicitanteId,
    });
    expect(criada).toMatchObject({ status: 'pendente', usuarioId: c.solicitanteId });

    const revisada = await solicitacoes.revisar({
      solicitacaoId: criada!.id,
      familiaId: c.familiaId,
      adminId: c.adminId,
      acao: 'aprovar',
    });
    expect(revisada).toMatchObject({ status: 'aprovada', respondidoPor: c.adminId });
    expect(await ehMembro(c)).toBe(true);
  });

  it('rejeitar em família ativa não vincula membro', async () => {
    const c = await semearFamilia('Rejeitar');
    const solicitacaoId = await semearPendente(c);
    const { solicitacoes } = novaSessao();

    const revisada = await solicitacoes.revisar({
      solicitacaoId,
      familiaId: c.familiaId,
      adminId: c.adminId,
      acao: 'rejeitar',
    });

    expect(revisada?.status).toBe('rejeitada');
    expect(await ehMembro(c)).toBe(false);
  });

  it('família já excluída: solicitar e revisar retornam null sem gravar', async () => {
    const c = await semearFamilia('JaExcluida');
    const solicitacaoId = await semearPendente(c);
    await banco.sql`UPDATE familias SET deleted_at = now() WHERE id = ${c.familiaId}`;
    const { solicitacoes } = novaSessao();

    const nova = await solicitacoes.solicitar({
      familiaId: c.familiaId,
      usuarioId: c.solicitanteId,
    });
    const revisada = await solicitacoes.revisar({
      solicitacaoId,
      familiaId: c.familiaId,
      adminId: c.adminId,
      acao: 'aprovar',
    });

    expect(nova).toBeNull();
    expect(revisada).toBeNull();
    expect(await totalDeSolicitacoes(c.familiaId)).toBe(1);
    expect(await ehMembro(c)).toBe(false);
  });

  it('multi-tenant: revisar com familiaId de outra família não encontra a solicitação', async () => {
    const [a, b] = await Promise.all([semearFamilia('TenantA'), semearFamilia('TenantB')]);
    const solicitacaoId = await semearPendente(a);
    const { solicitacoes } = novaSessao();

    const revisada = await solicitacoes.revisar({
      solicitacaoId,
      familiaId: b.familiaId,
      adminId: b.adminId,
      acao: 'aprovar',
    });

    expect(revisada).toBeNull();
    expect(await statusDa(solicitacaoId)).toBe('pendente');
  });
});
