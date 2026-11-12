import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { afterEach, describe, expect, it } from 'vitest';

import { DrizzleCategoriaRepository } from '../../modules/categoria/categoria.repository.js';
import { DrizzleMetodoPagamentoRepository } from '../../modules/metodo-pagamento/metodo-pagamento.repository.js';
import { usuarioFamilia } from '../schema.js';
import { DrizzleTransacaoRepository } from '../../modules/transacao/transacao.repository.js';
import { criarCenarioDuasFamilias, type CenarioDuasFamilias } from './cenario-duas-familias.js';
import { MigradorQuebradoFake } from './migrador-quebrado-fake.js';

/**
 * Fixture de duas famílias (issue #80). Cada cenário tem o próprio banco
 * descartável (nome uuid), então os testes são independentes entre si; o teste
 * de paralelismo abaixo cria 3 cenários simultâneos no mesmo processo.
 */
const cenarios: CenarioDuasFamilias[] = [];

async function novoCenario(): Promise<CenarioDuasFamilias> {
  const cenario = await criarCenarioDuasFamilias();
  cenarios.push(cenario);
  return cenario;
}

afterEach(async () => {
  await Promise.all(cenarios.splice(0).map((cenario) => cenario.descartar()));
});

describe('criarCenarioDuasFamilias', () => {
  it('cria duas famílias distintas com IDs explícitos', async () => {
    const { familiaA, familiaB } = await novoCenario();

    expect(familiaA.familiaId).not.toBe(familiaB.familiaId);
    expect(familiaA.admin.id).not.toBe(familiaB.admin.id);
    expect(familiaA.categoriaId).not.toBe(familiaB.categoriaId);
    expect(familiaA.transacaoIds).toHaveLength(2);
  });

  it('cria memberships admin e membro só na própria família', async () => {
    const { banco, familiaA, familiaB } = await novoCenario();
    const database = drizzle(banco.sql);

    const vinculos = await database
      .select()
      .from(usuarioFamilia)
      .where(eq(usuarioFamilia.familiaId, familiaA.familiaId));
    const vinculoDoAdminAEmB = await database
      .select()
      .from(usuarioFamilia)
      .where(
        and(
          eq(usuarioFamilia.usuarioId, familiaA.admin.id),
          eq(usuarioFamilia.familiaId, familiaB.familiaId),
        ),
      );

    expect(vinculos.map((v) => [v.usuarioId, v.role]).sort()).toEqual(
      [
        [familiaA.admin.id, 'admin'],
        [familiaA.membro.id, 'membro'],
      ].sort(),
    );
    expect(vinculoDoAdminAEmB).toEqual([]);
  });

  it('dados de A nunca aparecem em consultas filtradas por B (repositório real)', async () => {
    const { banco, familiaA, familiaB } = await novoCenario();
    const database = drizzle(banco.sql);
    const repositorio = new DrizzleTransacaoRepository(database);

    const deA = await repositorio.list({ familiaId: familiaA.familiaId });
    const deB = await repositorio.list({ familiaId: familiaB.familiaId });
    const categoriasDeB = await new DrizzleCategoriaRepository(database).listByFamiliaId({
      familiaId: familiaB.familiaId,
    });
    const metodosDeB = await new DrizzleMetodoPagamentoRepository(database).listByFamiliaId({
      familiaId: familiaB.familiaId,
    });

    expect(deA.map((t) => t.id).sort()).toEqual([...familiaA.transacaoIds].sort());
    expect(deB.map((t) => t.id).sort()).toEqual([...familiaB.transacaoIds].sort());
    expect(deB.some((t) => familiaA.transacaoIds.includes(t.id))).toBe(false);
    expect(categoriasDeB.map((c) => c.id)).toEqual([familiaB.categoriaId]);
    expect(metodosDeB.map((m) => m.id)).toEqual([familiaB.metodoPagamentoId]);
  });

  it('transações de cada família só referenciam cadastros da própria família', async () => {
    const { banco, familiaA, familiaB } = await novoCenario();
    const repositorio = new DrizzleTransacaoRepository(drizzle(banco.sql));

    for (const familia of [familiaA, familiaB]) {
      const transacoes = await repositorio.list({ familiaId: familia.familiaId });
      expect(transacoes.every((t) => t.categoriaId === familia.categoriaId)).toBe(true);
      expect(transacoes.every((t) => t.metodoPagamentoId === familia.metodoPagamentoId)).toBe(true);
      expect(transacoes.every((t) => t.usuarioRegistrouId === familia.admin.id)).toBe(true);
    }
  });

  it('permite repetir e rodar em paralelo sem colisão', async () => {
    const [primeiro, segundo, terceiro] = await Promise.all([
      novoCenario(),
      novoCenario(),
      novoCenario(),
    ]);

    const ids = [primeiro, segundo, terceiro].flatMap((c) => [
      c.familiaA.familiaId,
      c.familiaB.familiaId,
    ]);
    const [contagem] = await primeiro.banco.sql`SELECT count(*)::int AS total FROM familias`;

    expect(new Set(ids).size).toBe(6);
    expect(contagem?.total).toBe(2);
  });

  it('teardown remove o banco do cenário', async () => {
    const admin = await novoCenario();
    const cenario = await criarCenarioDuasFamilias();
    const nome = new URL(cenario.banco.url).pathname.slice(1);

    await cenario.descartar();
    const [existe] = await admin.banco.sql`
      SELECT count(*)::int AS total FROM pg_database WHERE datname = ${nome}`;

    expect(existe?.total).toBe(0);
  });

  it('falha de migration interrompe o setup com diagnóstico e não deixa banco órfão', async () => {
    const migrador = new MigradorQuebradoFake('0042_quebrada');
    const observador = await novoCenario();

    const erro = await criarCenarioDuasFamilias({ migrar: migrador.migrar }).catch((e: Error) => e);
    const nomeDoBanco = /ng_test_[0-9a-f]+/.exec((erro as Error).message)?.[0];
    const [existe] = await observador.banco.sql`
      SELECT count(*)::int AS total FROM pg_database WHERE datname = ${nomeDoBanco ?? ''}`;

    expect((erro as Error).message).toMatch(/Falha ao aplicar migrations.*0042_quebrada/s);
    expect(nomeDoBanco).toBeDefined();
    expect(existe?.total).toBe(0);
  });
});
