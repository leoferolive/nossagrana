import { drizzle } from 'drizzle-orm/postgres-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { DrizzleHistoricoRepository } from '../../modules/historico/historico.repository.js';
import { aplicarMigrations, criarBancoDescartavel, type BancoDescartavel } from './pg-harness.js';

vi.mock('../client.js', () => ({ db: undefined }));

// Issue #71: o job de fechamento só enxerga famílias não excluídas.
describe('listFamiliaIdsAtivas (pg)', () => {
  let banco: BancoDescartavel;

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
  });

  afterAll(async () => {
    await banco.descartar();
  });

  it('não devolve família com deleted_at preenchido', async () => {
    const [ativa] = await banco.sql`INSERT INTO familias (nome) VALUES ('Ativa') RETURNING id`;
    await banco.sql`INSERT INTO familias (nome, deleted_at) VALUES ('Excluida', now())`;
    const repo = new DrizzleHistoricoRepository(drizzle(banco.sql));

    const ids = await repo.listFamiliaIdsAtivas();

    expect(ids).toEqual([ativa!.id]);
  });
});
