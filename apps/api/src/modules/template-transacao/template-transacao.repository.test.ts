import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryTemplateTransacaoRepository } from './template-transacao.repository.js';
import type { TemplateTransacaoRepository } from './template-transacao.types.js';

describe('InMemoryTemplateTransacaoRepository', () => {
  let repo: TemplateTransacaoRepository;

  beforeEach(() => {
    repo = new InMemoryTemplateTransacaoRepository();
  });

  it('cria e lista templates por familiaId', async () => {
    await repo.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'cat1', criadoPor: 'u1' });
    await repo.create({ familiaId: 'f2', nome: 'Salário', tipo: 'receita', categoriaId: 'cat2', criadoPor: 'u2' });
    const f1 = await repo.listByFamiliaId({ familiaId: 'f1' });
    expect(f1).toHaveLength(1);
    expect(f1[0].nome).toBe('Luz');
  });

  it('filtra por tipo', async () => {
    await repo.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
    await repo.create({ familiaId: 'f1', nome: 'Salário', tipo: 'receita', categoriaId: 'c2', criadoPor: 'u1' });
    const receitas = await repo.listByFamiliaId({ familiaId: 'f1', tipo: 'receita' });
    expect(receitas).toHaveLength(1);
    expect(receitas[0].nome).toBe('Salário');
  });

  it('não lista templates inativos', async () => {
    const t = await repo.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
    await repo.deactivate({ id: t.id, familiaId: 'f1' });
    const lista = await repo.listByFamiliaId({ familiaId: 'f1' });
    expect(lista).toHaveLength(0);
  });

  it('isolamento multi-tenant: família A não vê templates de família B', async () => {
    await repo.create({ familiaId: 'fA', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
    await repo.create({ familiaId: 'fB', nome: 'Gás', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u2' });
    const fA = await repo.listByFamiliaId({ familiaId: 'fA' });
    expect(fA).toHaveLength(1);
    expect(fA[0].nome).toBe('Luz');
    const found = await repo.findById({ id: fA[0].id, familiaId: 'fB' });
    expect(found).toBeNull();
  });

  it('update parcial', async () => {
    const t = await repo.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
    const updated = await repo.update({ id: t.id, familiaId: 'f1', nome: 'Energia' });
    expect(updated?.nome).toBe('Energia');
    expect(updated?.categoriaId).toBe('c1');
  });

  it('reordena templates', async () => {
    const t1 = await repo.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1', ordem: 0 });
    const t2 = await repo.create({ familiaId: 'f1', nome: 'Gás', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1', ordem: 1 });
    await repo.reordenar({ familiaId: 'f1', itens: [{ id: t1.id, ordem: 1 }, { id: t2.id, ordem: 0 }] });
    const lista = await repo.listByFamiliaId({ familiaId: 'f1' });
    expect(lista[0].nome).toBe('Gás');
    expect(lista[1].nome).toBe('Luz');
  });

  it('findByIds retorna apenas templates ativos da família', async () => {
    const t1 = await repo.create({ familiaId: 'f1', nome: 'Luz', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
    const t2 = await repo.create({ familiaId: 'f1', nome: 'Gás', tipo: 'despesa', categoriaId: 'c1', criadoPor: 'u1' });
    await repo.deactivate({ id: t2.id, familiaId: 'f1' });
    const found = await repo.findByIds({ ids: [t1.id, t2.id], familiaId: 'f1' });
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(t1.id);
  });
});
