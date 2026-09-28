import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  aplicarMigrations,
  criarBancoDescartavel,
  type BancoDescartavel,
} from '../../db/tests/pg-harness.js';
import { verificarAcessoFamilia } from './familia-access.repository.js';

describe('family access against PostgreSQL', () => {
  let banco: BancoDescartavel;
  let usuarioId: string;
  let outroUsuarioId: string;
  let familiaAtivaId: string;
  let familiaExcluidaId: string;

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    const [usuario] = await banco.sql`INSERT INTO users (nome, email, senha_hash)
      VALUES ('Ana', 'ana-family-access@example.com', 'hash') RETURNING id`;
    const [outroUsuario] = await banco.sql`INSERT INTO users (nome, email, senha_hash)
      VALUES ('Bruno', 'bruno-family-access@example.com', 'hash') RETURNING id`;
    const [familiaAtiva] = await banco.sql`INSERT INTO familias (nome)
      VALUES ('Ativa') RETURNING id`;
    const [familiaExcluida] = await banco.sql`INSERT INTO familias (nome, deleted_at)
      VALUES ('Excluida', NOW()) RETURNING id`;
    usuarioId = usuario.id as string;
    outroUsuarioId = outroUsuario.id as string;
    familiaAtivaId = familiaAtiva.id as string;
    familiaExcluidaId = familiaExcluida.id as string;
    await banco.sql`INSERT INTO usuario_familia (usuario_id, familia_id)
      VALUES (${usuarioId}, ${familiaAtivaId}), (${usuarioId}, ${familiaExcluidaId}),
             (${outroUsuarioId}, ${familiaExcluidaId})`;
  });

  afterAll(() => banco?.descartar());

  it('distinguishes active, soft-deleted, and other-family access', async () => {
    const database = drizzle(banco.sql);

    expect(await verificarAcessoFamilia(database, usuarioId, familiaAtivaId)).toBe('ativa');
    expect(await verificarAcessoFamilia(database, usuarioId, familiaExcluidaId)).toBe('excluida');
    expect(await verificarAcessoFamilia(database, outroUsuarioId, familiaAtivaId)).toBe(
      'sem_acesso',
    );
  });
});
