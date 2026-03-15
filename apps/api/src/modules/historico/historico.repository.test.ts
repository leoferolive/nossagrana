import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  selectDistinct: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({
  db: mockDb,
}));

import {
  DrizzleHistoricoRepository,
  InMemoryHistoricoRepository,
} from './historico.repository.js';

const makeSnapshotRow = (overrides = {}) => ({
  id: 'snap-1',
  familiaId: 'f1',
  mesReferencia: '2026-03',
  totalReceitas: '1000.00',
  totalDespesas: '500.00',
  saldo: '500.00',
  dadosCategorias: [],
  dadosUsuarios: [],
  divergente: false,
  geradoEm: new Date('2026-03-31'),
  ...overrides,
});

describe('InMemoryHistoricoRepository', () => {
  let repo: InMemoryHistoricoRepository;

  beforeEach(() => {
    repo = new InMemoryHistoricoRepository();
  });

  it('listSnapshots returns empty when no snapshots', async () => {
    const result = await repo.listSnapshots('f1');
    expect(result).toEqual([]);
  });

  it('listSnapshots returns snapshots ordered by mesReferencia desc', async () => {
    repo.seedSnapshot({
      familiaId: 'f1',
      mesReferencia: '2026-01',
      totalReceitas: '500.00',
      totalDespesas: '200.00',
      saldo: '300.00',
      divergente: false,
      dadosCategorias: [],
      dadosUsuarios: [],
      geradoEm: new Date(),
    });
    repo.seedSnapshot({
      familiaId: 'f1',
      mesReferencia: '2026-03',
      totalReceitas: '1000.00',
      totalDespesas: '500.00',
      saldo: '500.00',
      divergente: false,
      dadosCategorias: [],
      dadosUsuarios: [],
      geradoEm: new Date(),
    });
    const result = await repo.listSnapshots('f1');
    expect(result[0].mesReferencia).toBe('2026-03');
    expect(result[1].mesReferencia).toBe('2026-01');
  });

  it('findSnapshot returns null when not found', async () => {
    const result = await repo.findSnapshot('f1', '2026-03');
    expect(result).toBeNull();
  });

  it('findSnapshot returns the snapshot when found', async () => {
    repo.seedSnapshot({
      familiaId: 'f1',
      mesReferencia: '2026-03',
      totalReceitas: '1000.00',
      totalDespesas: '500.00',
      saldo: '500.00',
      divergente: false,
      dadosCategorias: [],
      dadosUsuarios: [],
      geradoEm: new Date(),
    });
    const result = await repo.findSnapshot('f1', '2026-03');
    expect(result).not.toBeNull();
    expect(result?.mesReferencia).toBe('2026-03');
  });

  it('getResumoTransacoesMes returns zeros when no transacoes', async () => {
    const result = await repo.getResumoTransacoesMes('f1', '2026-03');
    expect(result).toEqual({
      mesReferencia: '2026-03',
      totalReceitas: '0.00',
      totalDespesas: '0.00',
      saldo: '0.00',
    });
  });

  it('getResumoTransacoesMes returns data when seeded', async () => {
    repo.seedTransacao({
      familiaId: 'f1',
      mesReferencia: '2026-03',
      totalReceitas: '1000.00',
      totalDespesas: '400.00',
    });
    const result = await repo.getResumoTransacoesMes('f1', '2026-03');
    expect(result.totalReceitas).toBe('1000.00');
    expect(result.totalDespesas).toBe('400.00');
    expect(result.saldo).toBe('600.00');
  });

  it('getMesesComTransacoes returns union of snapshots and transacoes', async () => {
    repo.seedSnapshot({
      familiaId: 'f1',
      mesReferencia: '2026-01',
      totalReceitas: '0.00',
      totalDespesas: '0.00',
      saldo: '0.00',
      divergente: false,
      dadosCategorias: [],
      dadosUsuarios: [],
      geradoEm: new Date(),
    });
    repo.seedTransacao({
      familiaId: 'f1',
      mesReferencia: '2026-03',
      totalReceitas: '100.00',
      totalDespesas: '50.00',
    });
    const result = await repo.getMesesComTransacoes('f1');
    expect(result).toContain('2026-01');
    expect(result).toContain('2026-03');
    expect(result[0]).toBe('2026-03'); // desc order
  });

  it('marcarDivergente sets divergente to true', async () => {
    repo.seedSnapshot({
      familiaId: 'f1',
      mesReferencia: '2026-03',
      totalReceitas: '0.00',
      totalDespesas: '0.00',
      saldo: '0.00',
      divergente: false,
      dadosCategorias: [],
      dadosUsuarios: [],
      geradoEm: new Date(),
    });
    await repo.marcarDivergente('f1', '2026-03');
    const snap = await repo.findSnapshot('f1', '2026-03');
    expect(snap?.divergente).toBe(true);
  });

  it('insertSnapshot inserts and returns the row', async () => {
    const input = {
      familiaId: 'f1',
      mesReferencia: '2026-03',
      totalReceitas: '1000.00',
      totalDespesas: '500.00',
      saldo: '500.00',
      dadosCategorias: [],
      dadosUsuarios: [],
    };
    const result = await repo.insertSnapshot(input);
    expect(result.familiaId).toBe('f1');
    expect(result.mesReferencia).toBe('2026-03');
    expect(result.divergente).toBe(false);
  });

  it('getTransacoesPorCategoria returns empty when no snapshot data', async () => {
    const result = await repo.getTransacoesPorCategoria('f1', '2026-03');
    expect(result).toEqual([]);
  });

  it('getTransacoesPorCategoria returns data when seeded', async () => {
    repo.seedTransacaoParaSnapshot('f1', '2026-03', {
      totalReceitas: '0.00',
      totalDespesas: '300.00',
      porCategoria: [{ categoriaId: 'c1', categoriaNome: 'Mercado', total: '300.00' }],
      porUsuario: [],
    });
    const result = await repo.getTransacoesPorCategoria('f1', '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].categoriaNome).toBe('Mercado');
  });

  it('getTransacoesPorUsuario returns empty when no snapshot data', async () => {
    const result = await repo.getTransacoesPorUsuario('f1', '2026-03');
    expect(result).toEqual([]);
  });

  it('getTransacoesPorUsuario returns data when seeded', async () => {
    repo.seedTransacaoParaSnapshot('f1', '2026-03', {
      totalReceitas: '0.00',
      totalDespesas: '300.00',
      porCategoria: [],
      porUsuario: [{ usuarioId: 'u1', usuarioNome: 'Leo', total: '300.00' }],
    });
    const result = await repo.getTransacoesPorUsuario('f1', '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].usuarioNome).toBe('Leo');
  });
});

describe('DrizzleHistoricoRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listSnapshots returns mapped rows', async () => {
    const row = makeSnapshotRow();
    const orderByMock = vi.fn().mockResolvedValue([row]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.listSnapshots('f1');
    expect(result).toHaveLength(1);
    expect(result[0].mesReferencia).toBe('2026-03');
  });

  it('listSnapshots returns empty array', async () => {
    const orderByMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.listSnapshots('f1');
    expect(result).toEqual([]);
  });

  it('findSnapshot returns mapped row when found', async () => {
    const row = makeSnapshotRow();
    const limitMock = vi.fn().mockResolvedValue([row]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.findSnapshot('f1', '2026-03');
    expect(result).not.toBeNull();
    expect(result?.mesReferencia).toBe('2026-03');
  });

  it('findSnapshot returns null when not found', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.findSnapshot('f1', '2026-03');
    expect(result).toBeNull();
  });

  it('getResumoTransacoesMes returns computed saldo', async () => {
    const whereMock = vi.fn().mockResolvedValue([{ totalReceitas: '1000', totalDespesas: '400' }]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.getResumoTransacoesMes('f1', '2026-03');
    expect(result.totalReceitas).toBe('1000.00');
    expect(result.totalDespesas).toBe('400.00');
    expect(result.saldo).toBe('600.00');
  });

  it('getResumoTransacoesMes handles null row', async () => {
    const whereMock = vi.fn().mockResolvedValue([undefined]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.getResumoTransacoesMes('f1', '2026-03');
    expect(result.totalReceitas).toBe('0.00');
    expect(result.totalDespesas).toBe('0.00');
    expect(result.saldo).toBe('0.00');
  });

  it('getMesesComTransacoes returns union sorted desc', async () => {
    const transacoesWhere = vi.fn().mockResolvedValue([{ mesReferencia: '2026-03' }]);
    const transacoesFrom = vi.fn().mockReturnValue({ where: transacoesWhere });

    const snapshotsWhere = vi.fn().mockResolvedValue([{ mesReferencia: '2026-01' }]);
    const snapshotsFrom = vi.fn().mockReturnValue({ where: snapshotsWhere });

    mockDb.selectDistinct.mockReturnValue({ from: transacoesFrom });
    mockDb.select.mockReturnValue({ from: snapshotsFrom });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.getMesesComTransacoes('f1');
    expect(result).toContain('2026-03');
    expect(result).toContain('2026-01');
    expect(result[0]).toBe('2026-03');
  });

  it('marcarDivergente calls update', async () => {
    const whereMock = vi.fn().mockResolvedValue(undefined);
    const setMock = vi.fn().mockReturnValue({ where: whereMock });
    mockDb.update.mockReturnValue({ set: setMock });

    const repo = new DrizzleHistoricoRepository();
    await expect(repo.marcarDivergente('f1', '2026-03')).resolves.toBeUndefined();
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('insertSnapshot inserts and returns mapped row', async () => {
    const row = makeSnapshotRow();
    const returningMock = vi.fn().mockResolvedValue([row]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    mockDb.insert.mockReturnValue({ values: valuesMock });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.insertSnapshot({
      familiaId: 'f1',
      mesReferencia: '2026-03',
      totalReceitas: '1000.00',
      totalDespesas: '500.00',
      saldo: '500.00',
      dadosCategorias: [],
      dadosUsuarios: [],
    });
    expect(result.mesReferencia).toBe('2026-03');
  });

  it('getTransacoesPorCategoria returns mapped rows', async () => {
    const rows = [{ categoriaId: 'c1', categoriaNome: 'Mercado', total: '300.5' }];
    const groupByMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.getTransacoesPorCategoria('f1', '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].categoriaNome).toBe('Mercado');
    expect(result[0].total).toBe('300.50');
  });

  it('getTransacoesPorUsuario returns mapped rows', async () => {
    const rows = [{ usuarioId: 'u1', usuarioNome: 'Leo', total: '200.0' }];
    const groupByMock = vi.fn().mockResolvedValue(rows);
    const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock });
    const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
    const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
    mockDb.select.mockReturnValue({ from: fromMock });

    const repo = new DrizzleHistoricoRepository();
    const result = await repo.getTransacoesPorUsuario('f1', '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].usuarioNome).toBe('Leo');
    expect(result[0].total).toBe('200.00');
  });
});
