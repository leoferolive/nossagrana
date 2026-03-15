import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({ db: mockDb }));

import { DrizzleRelatorioRepository, InMemoryRelatorioRepository } from './relatorio.repository.js';

// ─── InMemory ────────────────────────────────────────────────────────────────

describe('InMemoryRelatorioRepository', () => {
  let repo: InMemoryRelatorioRepository;

  beforeEach(() => {
    repo = new InMemoryRelatorioRepository();
  });

  const fakeRow = {
    familiaId: 'f1',
    tipo: 'despesa' as const,
    valor: '100.00',
    categoriaId: 'cat-1',
    categoriaNome: 'Alimentação',
    mesReferencia: '2026-03',
    usuarioId: 'u1',
    usuarioNome: 'Leo',
  };

  it('getTransacoes retorna transações filtradas por familia e mes', async () => {
    repo.seed({ transacoes: [fakeRow, { ...fakeRow, familiaId: 'f2' }] });
    const result = await repo.getTransacoes('f1', '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].familiaId).toBe('f1');
  });

  it('getTransacoes retorna vazio quando não há dados', async () => {
    const result = await repo.getTransacoes('f1', '2026-03');
    expect(result).toHaveLength(0);
  });
});

// ─── Drizzle (mockDb) ────────────────────────────────────────────────────────

describe('DrizzleRelatorioRepository', () => {
  let repo: DrizzleRelatorioRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DrizzleRelatorioRepository();
  });

  it('getTransacoes executa select com joins e retorna linhas', async () => {
    const fakeRow = {
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '100.00',
      categoriaId: 'cat-1',
      categoriaNome: 'Alimentação',
      mesReferencia: '2026-03',
      usuarioId: 'u1',
      usuarioNome: 'Leo',
    };

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([fakeRow]),
          }),
        }),
      }),
    });

    const result = await repo.getTransacoes('f1', '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].usuarioNome).toBe('Leo');
  });
});
