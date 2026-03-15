import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({ db: mockDb }));

import { DrizzleOrcamentoRepository, InMemoryOrcamentoRepository } from './orcamento.repository.js';

// ─── InMemory ────────────────────────────────────────────────────────────────

describe('InMemoryOrcamentoRepository', () => {
  let repo: InMemoryOrcamentoRepository;

  const baseInput = {
    familiaId: 'f1',
    categoriaId: 'cat-1',
    usuarioId: 'u1',
    valorLimite: '500.00',
    vigenciaInicio: '2026-03',
  };

  beforeEach(() => {
    repo = new InMemoryOrcamentoRepository();
  });

  it('listVigentes retorna orçamentos vigentes da família', async () => {
    await repo.insert(baseInput);
    const result = await repo.listVigentes('f1', '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].categoriaId).toBe('cat-1');
  });

  it('listVigentes filtra por familia', async () => {
    await repo.insert(baseInput);
    await repo.insert({ ...baseInput, familiaId: 'f2' });
    const result = await repo.listVigentes('f1', '2026-03');
    expect(result).toHaveLength(1);
  });

  it('getGastosPorCategoria soma apenas despesas do mes', async () => {
    repo.seedTransacao({
      familiaId: 'f1',
      categoriaId: 'cat-1',
      mesReferencia: '2026-03',
      valor: '100.00',
    });
    repo.seedTransacao({
      familiaId: 'f1',
      categoriaId: 'cat-1',
      mesReferencia: '2026-03',
      valor: '50.00',
    });
    repo.seedTransacao({
      familiaId: 'f1',
      categoriaId: 'cat-1',
      mesReferencia: '2026-03',
      valor: '200.00',
      tipo: 'receita',
    });
    const map = await repo.getGastosPorCategoria('f1', '2026-03');
    expect(map.get('cat-1')).toBe('150.00');
  });

  it('findAberto retorna registro sem vigenciaFim', async () => {
    await repo.insert(baseInput);
    const found = await repo.findAberto('f1', 'cat-1');
    expect(found).not.toBeNull();
    expect(found?.vigenciaFim).toBeNull();
  });

  it('findAberto retorna null se nao encontrado', async () => {
    const found = await repo.findAberto('f1', 'cat-nao-existe');
    expect(found).toBeNull();
  });

  it('encerrar seta vigenciaFim', async () => {
    const inserted = await repo.insert(baseInput);
    await repo.encerrar(inserted.id, 'f1', '2026-02');
    const found = await repo.findAberto('f1', 'cat-1');
    expect(found).toBeNull();
  });

  it('listHistorico retorna historico em ordem decrescente', async () => {
    await repo.insert({ ...baseInput, vigenciaInicio: '2026-01' });
    await repo.insert({ ...baseInput, vigenciaInicio: '2026-03' });
    const hist = await repo.listHistorico('f1', 'cat-1');
    expect(hist[0].vigenciaInicio).toBe('2026-03');
    expect(hist[1].vigenciaInicio).toBe('2026-01');
  });
});

// ─── Drizzle (mockDb) ────────────────────────────────────────────────────────

describe('DrizzleOrcamentoRepository', () => {
  let repo: DrizzleOrcamentoRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DrizzleOrcamentoRepository();
  });

  const fakeVigente = {
    id: 'oc1',
    categoriaId: 'cat-1',
    categoriaNome: 'Alimentação',
    valorLimite: '500.00',
    vigenciaInicio: '2026-03',
    vigenciaFim: null,
  };

  const fakeHistorico = {
    id: 'oc1',
    categoriaId: 'cat-1',
    valorLimite: '500.00',
    vigenciaInicio: '2026-03',
    vigenciaFim: null,
    criadoEm: new Date(),
  };

  it('listVigentes executa select e retorna vigentes', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([fakeVigente]),
        }),
      }),
    });
    const result = await repo.listVigentes('f1', '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].categoriaId).toBe('cat-1');
  });

  it('getGastosPorCategoria agrupa e retorna mapa', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockResolvedValue([{ categoriaId: 'cat-1', totalGasto: '150.00' }]),
        }),
      }),
    });
    const map = await repo.getGastosPorCategoria('f1', '2026-03');
    expect(map.get('cat-1')).toBe('150.00');
  });

  it('findAberto retorna registro quando encontrado', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([fakeHistorico]),
        }),
      }),
    });
    const result = await repo.findAberto('f1', 'cat-1');
    expect(result).not.toBeNull();
    expect(result?.categoriaId).toBe('cat-1');
  });

  it('findAberto retorna null quando nao encontrado', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    const result = await repo.findAberto('f1', 'cat-nao-existe');
    expect(result).toBeNull();
  });

  it('encerrar executa update com familiaId', async () => {
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    });
    await repo.encerrar('oc1', 'f1', '2026-02');
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
  });

  it('insert persiste e retorna novo registro', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([fakeHistorico]),
      }),
    });
    const result = await repo.insert({
      familiaId: 'f1',
      categoriaId: 'cat-1',
      usuarioId: 'u1',
      valorLimite: '500.00',
      vigenciaInicio: '2026-03',
    });
    expect(result.categoriaId).toBe('cat-1');
  });

  it('listHistorico executa select ordenado', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([fakeHistorico]),
        }),
      }),
    });
    const result = await repo.listHistorico('f1', 'cat-1');
    expect(result).toHaveLength(1);
  });
});
