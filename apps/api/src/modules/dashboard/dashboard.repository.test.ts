import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));
vi.mock('../../db/client.js', () => ({ db: mockDb }));

import {
  DrizzleDashboardRepository,
  InMemoryDashboardRepository,
} from './dashboard.repository.js';

describe('InMemoryDashboardRepository', () => {
  let repo: InMemoryDashboardRepository;

  beforeEach(() => {
    repo = new InMemoryDashboardRepository();
  });

  it('getResumoMes retorna zeros sem dados', async () => {
    const r = await repo.getResumoMes('f1', '2026-03');
    expect(r).toEqual({ totalReceitas: '0.00', totalDespesas: '0.00', saldo: '0.00' });
  });

  it('getResumoMes agrega receitas e despesas corretamente', async () => {
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'receita', valor: '5000.00', data: '2026-03-05', categoriaId: 'c1' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '1500.00', data: '2026-03-10', categoriaId: 'c2' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '500.00', data: '2026-03-15', categoriaId: 'c1' },
        { familiaId: 'f2', mesReferencia: '2026-03', tipo: 'despesa', valor: '9999.00', data: '2026-03-01', categoriaId: 'c3' }, // outra familia
      ],
    });
    const r = await repo.getResumoMes('f1', '2026-03');
    expect(r.totalReceitas).toBe('5000.00');
    expect(r.totalDespesas).toBe('2000.00');
    expect(r.saldo).toBe('3000.00');
  });

  it('getSnapshotMes retorna null sem snapshot', async () => {
    const s = await repo.getSnapshotMes('f1', '2026-02');
    expect(s).toBeNull();
  });

  it('getSnapshotMes retorna snapshot quando existe', async () => {
    repo.seed({
      snapshots: [
        { familiaId: 'f1', mesReferencia: '2026-02', totalReceitas: '4000.00', totalDespesas: '3000.00', saldo: '1000.00' },
      ],
    });
    const s = await repo.getSnapshotMes('f1', '2026-02');
    expect(s).toMatchObject({ totalReceitas: '4000.00', totalDespesas: '3000.00', saldo: '1000.00' });
  });

  it('getDistribuicaoCategorias retorna apenas despesas, ordenadas por total desc', async () => {
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '100.00', data: '2026-03-01', categoriaId: 'c1', categoriaNome: 'Alimentação' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '400.00', data: '2026-03-02', categoriaId: 'c2', categoriaNome: 'Lazer' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'receita', valor: '5000.00', data: '2026-03-01', categoriaId: 'c3', categoriaNome: 'Salário' },
      ],
    });
    const dist = await repo.getDistribuicaoCategorias('f1', '2026-03');
    expect(dist).toHaveLength(2);
    expect(dist[0].categoriaId).toBe('c2'); // maior primeiro
    expect(dist[0].total).toBe('400.00');
    expect(dist[1].total).toBe('100.00');
  });

  it('getDistribuicaoCategorias exclui categorias com sistema=true', async () => {
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '100.00', data: '2026-03-01', categoriaId: 'c1', categoriaNome: 'Alimentação', categoriaSistema: false },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '500.00', data: '2026-03-02', categoriaId: 'c-sys', categoriaNome: 'Cofrinho', categoriaSistema: true },
      ],
    });
    const dist = await repo.getDistribuicaoCategorias('f1', '2026-03');
    expect(dist).toHaveLength(1);
    expect(dist[0].categoriaId).toBe('c1');
  });

  it('getDistribuicaoCategorias retorna [] sem despesas', async () => {
    const dist = await repo.getDistribuicaoCategorias('f1', '2026-03');
    expect(dist).toEqual([]);
  });

  it('getTransacoesPorDia retorna sparse (só dias com transações)', async () => {
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '100.00', data: '2026-03-05', categoriaId: 'c1' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'receita', valor: '200.00', data: '2026-03-05', categoriaId: 'c2' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '50.00', data: '2026-03-10', categoriaId: 'c1' },
      ],
    });
    const dias = await repo.getTransacoesPorDia('f1', '2026-03');
    const dia5 = dias.find((d) => d.dia === '2026-03-05');
    const dia10 = dias.find((d) => d.dia === '2026-03-10');
    expect(dia5?.totalDespesas).toBe('100.00');
    expect(dia5?.totalReceitas).toBe('200.00');
    expect(dia10?.totalDespesas).toBe('50.00');
    expect(dias.length).toBe(2); // sparse — apenas dias com atividade; o DashboardService densifica
  });

  it('getOrcamentosVigentes filtra por vigência', async () => {
    repo.seed({
      orcamentos: [
        { familiaId: 'f1', categoriaId: 'c1', categoriaNome: 'Alimentação', valorLimite: '1000.00', vigenciaInicio: '2026-01', vigenciaFim: null },
        { familiaId: 'f1', categoriaId: 'c2', categoriaNome: 'Lazer', valorLimite: '500.00', vigenciaInicio: '2026-01', vigenciaFim: '2026-02' }, // expirado
        { familiaId: 'f1', categoriaId: 'c3', categoriaNome: 'Transporte', valorLimite: '300.00', vigenciaInicio: '2026-04', vigenciaFim: null }, // futuro
      ],
    });
    const orcamentos = await repo.getOrcamentosVigentes('f1', '2026-03');
    expect(orcamentos).toHaveLength(1);
    expect(orcamentos[0].categoriaId).toBe('c1');
  });

  it('getGastosPorCategoria agrega despesas por categoria no mês', async () => {
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '300.00', data: '2026-03-01', categoriaId: 'c1' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '200.00', data: '2026-03-10', categoriaId: 'c1' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '100.00', data: '2026-03-15', categoriaId: 'c2' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'receita', valor: '999.00', data: '2026-03-01', categoriaId: 'c1' }, // ignorar receita
      ],
    });
    const gastos = await repo.getGastosPorCategoria('f1', '2026-03');
    const c1 = gastos.find((g) => g.categoriaId === 'c1');
    expect(c1?.totalGasto).toBe('500.00');
  });
});

describe('DrizzleDashboardRepository — wiring', () => {
  it('getResumoMes chama db.select', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ totalReceitas: '0', totalDespesas: '0' }]),
      }),
    });
    const repo = new DrizzleDashboardRepository();
    await expect(repo.getResumoMes('f1', '2026-03')).resolves.toBeDefined();
  });
});
