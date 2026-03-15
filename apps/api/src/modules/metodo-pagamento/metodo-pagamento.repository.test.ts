import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../db/client.js', () => ({ db: mockDb }));

import {
  DrizzleMetodoPagamentoRepository,
  InMemoryMetodoPagamentoRepository,
} from './metodo-pagamento.repository.js';

// ─── InMemory ────────────────────────────────────────────────────────────────

describe('InMemoryMetodoPagamentoRepository', () => {
  let repo: InMemoryMetodoPagamentoRepository;

  beforeEach(() => {
    repo = new InMemoryMetodoPagamentoRepository();
  });

  const baseInput = {
    familiaId: 'f1',
    nome: 'Nubank',
    tipo: 'credito' as const,
    dataFechamento: 15,
    dataVencimento: 22,
    usuarioDonoId: 'u1',
  };

  it('listByFamiliaId retorna apenas ativos da família', async () => {
    await repo.create(baseInput);
    await repo.create({ ...baseInput, familiaId: 'f2', nome: 'Outro' });
    const result = await repo.listByFamiliaId({ familiaId: 'f1' });
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('Nubank');
  });

  it('create persiste e retorna metodo', async () => {
    const created = await repo.create(baseInput);
    expect(created.id).toBeDefined();
    expect(created.ativo).toBe(true);
  });

  it('update modifica campos e retorna atualizado', async () => {
    const created = await repo.create(baseInput);
    const updated = await repo.update({
      id: created.id,
      familiaId: 'f1',
      nome: 'Nubank Black',
      tipo: 'credito',
      dataFechamento: 20,
      dataVencimento: 27,
    });
    expect(updated?.nome).toBe('Nubank Black');
    expect(updated?.dataFechamento).toBe(20);
  });

  it('update retorna null quando nao encontrado', async () => {
    const result = await repo.update({
      id: 'nao-existe',
      familiaId: 'f1',
      nome: 'X',
      tipo: 'credito',
      dataFechamento: null,
      dataVencimento: null,
    });
    expect(result).toBeNull();
  });

  it('deactivate marca como inativo', async () => {
    const created = await repo.create(baseInput);
    const deactivated = await repo.deactivate({ id: created.id, familiaId: 'f1' });
    expect(deactivated?.ativo).toBe(false);
    const lista = await repo.listByFamiliaId({ familiaId: 'f1' });
    expect(lista).toHaveLength(0);
  });

  it('deactivate retorna null quando nao encontrado', async () => {
    const result = await repo.deactivate({ id: 'nao-existe', familiaId: 'f1' });
    expect(result).toBeNull();
  });

  it('findById retorna metodo quando encontrado', async () => {
    const created = await repo.create(baseInput);
    const found = await repo.findById({ id: created.id, familiaId: 'f1' });
    expect(found).not.toBeNull();
    expect(found?.nome).toBe('Nubank');
  });

  it('findById retorna null quando nao encontrado', async () => {
    const result = await repo.findById({ id: 'nao-existe', familiaId: 'f1' });
    expect(result).toBeNull();
  });

  it('getFatura retorna transacoes filtradas', async () => {
    const created = await repo.create(baseInput);
    const fakeTransacao = {
      id: 't1',
      descricao: 'Mercado',
      valor: '200.00',
      data: '2026-03-10',
      categoriaId: 'c1',
      categoriaNome: 'Alimentação',
      usuarioNome: 'Leo',
      parcelaAtual: null,
      numeroParcelas: null,
      familiaId: 'f1',
      metodoPagamentoId: created.id,
      mesReferencia: '2026-03',
    };
    repo.seedFatura(fakeTransacao);
    const result = await repo.getFatura('f1', created.id, '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].descricao).toBe('Mercado');
  });
});

// ─── Drizzle (mockDb) ────────────────────────────────────────────────────────

describe('DrizzleMetodoPagamentoRepository', () => {
  let repo: DrizzleMetodoPagamentoRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DrizzleMetodoPagamentoRepository();
  });

  const fakeRow = {
    id: 'mp1',
    familiaId: 'f1',
    nome: 'Nubank',
    tipo: 'credito',
    dataFechamento: 15,
    dataVencimento: 22,
    usuarioDonoId: 'u1',
    ativo: true,
    criadoEm: new Date(),
  };

  it('listByFamiliaId executa select e mapeia resultado', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([fakeRow]),
      }),
    });

    const result = await repo.listByFamiliaId({ familiaId: 'f1' });
    expect(result).toHaveLength(1);
    expect(result[0].nome).toBe('Nubank');
  });

  it('create executa insert e retorna criado', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([fakeRow]),
      }),
    });

    const result = await repo.create({
      familiaId: 'f1',
      nome: 'Nubank',
      tipo: 'credito',
      dataFechamento: 15,
      dataVencimento: 22,
      usuarioDonoId: 'u1',
    });
    expect(result.nome).toBe('Nubank');
  });

  it('update executa update e retorna atualizado', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...fakeRow, nome: 'Nubank Black' }]),
        }),
      }),
    });

    const result = await repo.update({
      id: 'mp1',
      familiaId: 'f1',
      nome: 'Nubank Black',
      tipo: 'credito',
      dataFechamento: 20,
      dataVencimento: 27,
    });
    expect(result?.nome).toBe('Nubank Black');
  });

  it('update retorna null quando nao encontrado', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await repo.update({
      id: 'nao-existe',
      familiaId: 'f1',
      nome: 'X',
      tipo: 'credito',
      dataFechamento: null,
      dataVencimento: null,
    });
    expect(result).toBeNull();
  });

  it('deactivate executa update e retorna desativado', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...fakeRow, ativo: false }]),
        }),
      }),
    });

    const result = await repo.deactivate({ id: 'mp1', familiaId: 'f1' });
    expect(result?.ativo).toBe(false);
  });

  it('deactivate retorna null quando nao encontrado', async () => {
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await repo.deactivate({ id: 'nao-existe', familiaId: 'f1' });
    expect(result).toBeNull();
  });

  it('findById executa select e retorna metodo', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([fakeRow]),
      }),
    });
    const result = await repo.findById({ id: 'mp1', familiaId: 'f1' });
    expect(result).not.toBeNull();
    expect(result?.nome).toBe('Nubank');
  });

  it('findById retorna null quando nao encontrado', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    const result = await repo.findById({ id: 'nao-existe', familiaId: 'f1' });
    expect(result).toBeNull();
  });

  it('getFatura executa select com joins e retorna transacoes', async () => {
    const fakeTransacao = {
      id: 't1',
      descricao: 'Mercado',
      valor: '200.00',
      data: '2026-03-10',
      categoriaId: 'c1',
      categoriaNome: 'Alimentação',
      usuarioNome: 'Leo',
      parcelaAtual: null,
      numeroParcelas: null,
    };
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([fakeTransacao]),
            }),
          }),
        }),
      }),
    });
    const result = await repo.getFatura('f1', 'mp1', '2026-03');
    expect(result).toHaveLength(1);
    expect(result[0].descricao).toBe('Mercado');
  });
});
