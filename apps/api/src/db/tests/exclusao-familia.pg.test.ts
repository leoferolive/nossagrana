import { randomBytes, randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DrizzleConviteConsumer } from '../../modules/familia/familia-convite.repository.js';
import { DrizzleFamiliaExclusao } from '../../modules/familia/familia-exclusao.repository.js';
import {
  aplicarMigrations,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Exclusão de família no PostgreSQL real (#66): `deleted_at` e a invalidação
 * dos convites pendentes são uma transação só, e o consumo posterior falha.
 */
const DIA_MS = 24 * 60 * 60 * 1000;

describe('Exclusão de família no PostgreSQL', () => {
  let banco: BancoDescartavel;
  let conexao: postgres.Sql;
  let exclusao: DrizzleFamiliaExclusao;

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    conexao = conectar(banco.url);
    exclusao = new DrizzleFamiliaExclusao(drizzle(conexao));
  });

  afterAll(async () => {
    await conexao?.end();
    await banco?.descartar();
  });

  async function semearUsuario(nome: string): Promise<string> {
    const [linha] = await banco.sql`INSERT INTO users (nome, email, senha_hash)
      VALUES (${nome}, ${`${nome}-${randomUUID()}@example.com`}, 'hash') RETURNING id`;
    return linha!.id as string;
  }

  async function semearFamilia(nome: string) {
    const adminId = await semearUsuario(`admin-${nome}`);
    const [familia] = await banco.sql`INSERT INTO familias (nome) VALUES (${nome}) RETURNING id`;
    const familiaId = familia!.id as string;
    await banco.sql`INSERT INTO usuario_familia (usuario_id, familia_id, role)
      VALUES (${adminId}, ${familiaId}, 'admin')`;
    return { familiaId, adminId };
  }

  async function semearConvite(
    c: { familiaId: string; adminId: string },
    expiraEm = new Date(Date.now() + DIA_MS),
    usadoPor: string | null = null,
  ) {
    const codigo = randomBytes(6).toString('hex').toUpperCase();
    await banco.sql`INSERT INTO convites (familia_id, codigo, criado_por, expira_em, usado_por)
      VALUES (${c.familiaId}, ${codigo}, ${c.adminId}, ${expiraEm}, ${usadoPor})`;
    return codigo;
  }

  async function expiraEm(codigo: string): Promise<Date> {
    const [linha] = await banco.sql`SELECT expira_em FROM convites WHERE codigo = ${codigo}`;
    return linha!.expira_em as Date;
  }

  async function excluidaEm(familiaId: string): Promise<Date | null> {
    const [linha] = await banco.sql`SELECT deleted_at FROM familias WHERE id = ${familiaId}`;
    return (linha!.deleted_at as Date | null) ?? null;
  }

  it('invalida só os convites pendentes da família excluída e recusa o consumo depois', async () => {
    const alvo = await semearFamilia('Alvo');
    const outra = await semearFamilia('Outra');
    const pendente = await semearConvite(alvo);
    const jaUsado = await semearConvite(alvo, new Date(Date.now() + DIA_MS), alvo.adminId);
    const usadoExpiraEm = await expiraEm(jaUsado);
    const conviteOutraFamilia = await semearConvite(outra);
    const outraExpiraEm = await expiraEm(conviteOutraFamilia);

    expect(await exclusao.excluir({ familiaId: alvo.familiaId })).toBe(true);

    expect(await excluidaEm(alvo.familiaId)).not.toBeNull();
    expect((await expiraEm(pendente)).getTime()).toBeLessThanOrEqual(Date.now());
    expect(await expiraEm(jaUsado)).toEqual(usadoExpiraEm);
    expect(await expiraEm(conviteOutraFamilia)).toEqual(outraExpiraEm);
    expect(await excluidaEm(outra.familiaId)).toBeNull();

    const novato = await semearUsuario('novato');
    const resultado = await new DrizzleConviteConsumer(drizzle(conexao)).consumir({
      codigo: pendente,
      usuarioId: novato,
    });
    expect(resultado.status).toBe('invalido');
    const [vinculo] = await banco.sql`SELECT 1 FROM usuario_familia
      WHERE usuario_id = ${novato} AND familia_id = ${alvo.familiaId}`;
    expect(vinculo).toBeUndefined();
  });

  it('segunda exclusão da mesma família retorna false sem alterar o instante da exclusão', async () => {
    const alvo = await semearFamilia('Repetida');
    await exclusao.excluir({ familiaId: alvo.familiaId });
    const primeira = await excluidaEm(alvo.familiaId);

    expect(await exclusao.excluir({ familiaId: alvo.familiaId })).toBe(false);
    expect(await excluidaEm(alvo.familiaId)).toEqual(primeira);
  });

  it('falha ao invalidar convites desfaz a exclusão (nada parcial)', async () => {
    const alvo = await semearFamilia('Rollback');
    const pendente = await semearConvite(alvo);
    const antes = await expiraEm(pendente);
    const sufixo = alvo.familiaId.replaceAll('-', '');
    await banco.sql.unsafe(`
      CREATE FUNCTION falha_convite_${sufixo}() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'falha injetada ao invalidar convite'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER falha_convite BEFORE UPDATE ON convites
        FOR EACH ROW WHEN (OLD.familia_id = '${alvo.familiaId}')
        EXECUTE FUNCTION falha_convite_${sufixo}();`);

    await expect(exclusao.excluir({ familiaId: alvo.familiaId })).rejects.toThrow();

    expect(await excluidaEm(alvo.familiaId)).toBeNull();
    expect(await expiraEm(pendente)).toEqual(antes);
  });
});
