import { randomBytes, randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DrizzleConviteConsumer } from '../../modules/familia/familia-convite.repository.js';
import type { ConsumoConviteResultado } from '../../modules/familia/familia.types.js';
import { esperandoLock } from './pg-cofrinho.js';
import {
  aplicarMigrations,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Consumo atômico e de uso único de convite no PostgreSQL real (#67). Cada
 * "requisição" usa uma conexão própria (pool de 1) com o adapter de
 * PRODUÇÃO, então a corrida é entre sessões de verdade. O caso determinístico
 * segura a linha do convite numa transação aberta e só libera depois que o
 * banco mostra a 2ª requisição esperando o lock.
 */
const RODADAS = [1, 2, 3, 4, 5];
const DIA_MS = 24 * 60 * 60 * 1000;

interface Cenario {
  familiaId: string;
  adminId: string;
}

describe('Consumo de convite no PostgreSQL', () => {
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

  /** Nova sessão independente com o wiring de produção do consumo. */
  function novaSessao(): DrizzleConviteConsumer {
    const conexao = conectar(banco.url);
    conexoes.push(conexao);
    return new DrizzleConviteConsumer(drizzle(conexao));
  }

  async function semearUsuario(nome: string): Promise<string> {
    const [linha] = await banco.sql`INSERT INTO users (nome, email, senha_hash)
      VALUES (${nome}, ${`${nome}-${randomUUID()}@example.com`}, 'hash') RETURNING id`;
    return linha!.id as string;
  }

  async function semearFamilia(nome: string): Promise<Cenario> {
    const adminId = await semearUsuario(`admin-${nome}`);
    const [familia] = await banco.sql`INSERT INTO familias (nome) VALUES (${nome}) RETURNING id`;
    const familiaId = familia!.id as string;
    await banco.sql`INSERT INTO usuario_familia (usuario_id, familia_id, role)
      VALUES (${adminId}, ${familiaId}, 'admin')`;
    return { familiaId, adminId };
  }

  async function semearConvite(c: Cenario, expiraEm = new Date(Date.now() + DIA_MS)) {
    const codigo = randomBytes(6).toString('hex').toUpperCase();
    await banco.sql`INSERT INTO convites (familia_id, codigo, criado_por, expira_em)
      VALUES (${c.familiaId}, ${codigo}, ${c.adminId}, ${expiraEm})`;
    return codigo;
  }

  /** Falha injetada: trigger que aborta o INSERT de membership só desta família. */
  async function falharInsertsDeMembership(familiaId: string): Promise<void> {
    const sufixo = familiaId.replaceAll('-', '');
    await banco.sql.unsafe(`
      CREATE FUNCTION falha_membership_${sufixo}() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'falha injetada no insert da membership'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER falha_membership BEFORE INSERT ON usuario_familia
        FOR EACH ROW WHEN (NEW.familia_id = '${familiaId}')
        EXECUTE FUNCTION falha_membership_${sufixo}();`);
  }

  async function consumidoPor(codigo: string): Promise<string | null> {
    const [linha] = await observador`SELECT usado_por FROM convites WHERE codigo = ${codigo}`;
    return (linha?.usado_por as string | null) ?? null;
  }

  async function membros(familiaId: string): Promise<number> {
    const [linha] = await observador`SELECT count(*)::int AS n FROM usuario_familia
      WHERE familia_id = ${familiaId} AND role = 'membro'`;
    return linha?.n as number;
  }

  const statusDe = (resultados: ConsumoConviteResultado[]) =>
    resultados.map((r) => r.status).sort();

  it.each(RODADAS)('rodada %i: 3 sessões concorrentes, exatamente uma entra', async () => {
    const cenario = await semearFamilia('Corrida');
    const codigo = await semearConvite(cenario);
    const usuarios = await Promise.all([
      semearUsuario('a'),
      semearUsuario('b'),
      semearUsuario('c'),
    ]);

    const resultados = await Promise.all(
      usuarios.map((usuarioId) => novaSessao().consumir({ codigo, usuarioId })),
    );

    expect(statusDe(resultados)).toEqual(['entrou', 'usado', 'usado']);
    expect(await membros(cenario.familiaId)).toBe(1);
    expect(usuarios).toContain(await consumidoPor(codigo));
  });

  it('perdedora bloqueada no lock da linha reavalia após o commit e recebe "usado"', async () => {
    const cenario = await semearFamilia('Bloqueio');
    const codigo = await semearConvite(cenario);
    const [vencedor, perdedor] = await Promise.all([semearUsuario('v'), semearUsuario('p')]);

    let perdedora!: Promise<ConsumoConviteResultado>;
    await banco.sql.begin(async (tx) => {
      await tx.unsafe('UPDATE convites SET usado_por = $1, usado_em = now() WHERE codigo = $2', [
        vencedor,
        codigo,
      ]);
      await tx.unsafe(
        `INSERT INTO usuario_familia (usuario_id, familia_id, role) VALUES ($1, $2, 'membro')`,
        [vencedor, cenario.familiaId],
      );
      perdedora = novaSessao().consumir({ codigo, usuarioId: perdedor });
      await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
    });

    expect(await perdedora).toEqual({ status: 'usado' });
    expect(await membros(cenario.familiaId)).toBe(1);
    expect(await consumidoPor(codigo)).toBe(vencedor);
  });

  it('rollback: falha ao criar a membership (após o UPDATE) desfaz o consumo do convite', async () => {
    const cenario = await semearFamilia('Rollback');
    const codigo = await semearConvite(cenario);
    const usuarioId = await semearUsuario('rollback');
    await falharInsertsDeMembership(cenario.familiaId);

    await expect(novaSessao().consumir({ codigo, usuarioId })).rejects.toThrow(
      /insert into "usuario_familia"/,
    );

    expect(await consumidoPor(codigo)).toBeNull();
    expect(await membros(cenario.familiaId)).toBe(0);
  });

  it('repetição pelo mesmo usuário não cria novo vínculo: 2ª chamada é "usado"', async () => {
    const cenario = await semearFamilia('Repeticao');
    const codigo = await semearConvite(cenario);
    const usuarioId = await semearUsuario('repete');

    const primeira = await novaSessao().consumir({ codigo, usuarioId });
    const segunda = await novaSessao().consumir({ codigo, usuarioId });

    expect([primeira.status, segunda.status]).toEqual(['entrou', 'usado']);
    expect(await membros(cenario.familiaId)).toBe(1);
  });

  it('quem já é membro recebe "ja_membro" e o convite segue livre', async () => {
    const cenario = await semearFamilia('JaMembro');
    const codigo = await semearConvite(cenario);

    const resultado = await novaSessao().consumir({ codigo, usuarioId: cenario.adminId });

    expect(resultado).toMatchObject({ status: 'ja_membro', familia: { id: cenario.familiaId } });
    expect(await consumidoPor(codigo)).toBeNull();
    const outro = await novaSessao().consumir({ codigo, usuarioId: await semearUsuario('novo') });
    expect(outro.status).toBe('entrou');
  });

  it('convite expirado: "expirado", sem consumo e sem membership', async () => {
    const cenario = await semearFamilia('Expirado');
    const codigo = await semearConvite(cenario, new Date(Date.now() - DIA_MS));

    const resultado = await novaSessao().consumir({ codigo, usuarioId: await semearUsuario('x') });

    expect(resultado).toEqual({ status: 'expirado' });
    expect(await consumidoPor(codigo)).toBeNull();
    expect(await membros(cenario.familiaId)).toBe(0);
  });

  it('família excluída (soft delete): "invalido" mesmo com convite livre e válido', async () => {
    const cenario = await semearFamilia('Excluida');
    const codigo = await semearConvite(cenario);
    await banco.sql`UPDATE familias SET deleted_at = now() WHERE id = ${cenario.familiaId}`;

    const resultado = await novaSessao().consumir({ codigo, usuarioId: await semearUsuario('y') });

    expect(resultado).toEqual({ status: 'invalido' });
    expect(await consumidoPor(codigo)).toBeNull();
    expect(await membros(cenario.familiaId)).toBe(0);
  });

  it('código inexistente: "invalido"', async () => {
    const resultado = await novaSessao().consumir({
      codigo: 'NAOEXISTE',
      usuarioId: await semearUsuario('z'),
    });

    expect(resultado).toEqual({ status: 'invalido' });
  });

  it('multi-tenant: convite da família A nunca cria membership na família B', async () => {
    const [a, b] = await Promise.all([semearFamilia('TenantA'), semearFamilia('TenantB')]);
    const codigoA = await semearConvite(a);
    const usuarioId = await semearUsuario('tenant');

    await novaSessao().consumir({ codigo: codigoA, usuarioId });

    expect(await membros(a.familiaId)).toBe(1);
    expect(await membros(b.familiaId)).toBe(0);
  });

  it('defesa em profundidade: a PK impede vínculo usuário-família duplicado', async () => {
    const cenario = await semearFamilia('PkDuplicada');

    await expect(
      banco.sql`INSERT INTO usuario_familia (usuario_id, familia_id, role)
        VALUES (${cenario.adminId}, ${cenario.familiaId}, 'membro')`,
    ).rejects.toThrow(/usuario_familia_usuario_id_familia_id_pk/);
  });
});
