import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from './api-client';
import {
  CategoriaService,
  MetodoPagamentoService,
  TransacaoService,
} from './core-financeiro.service';

const buildApiClient = (overrides?: Partial<ApiClient>) =>
  ({
    request: vi.fn(),
    ...overrides,
  }) as unknown as ApiClient;

describe('CategoriaService', () => {
  let apiClient: ApiClient;
  let service: CategoriaService;

  beforeEach(() => {
    apiClient = buildApiClient();
    service = new CategoriaService(apiClient);
  });

  it('lista categorias', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      categorias: [{ id: 'c1', nome: 'Mercado', tipo: 'despesa', ativo: true }],
    });

    const result = await service.listar('familia-x-id');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/categorias',
      expect.objectContaining({ headers: expect.anything() }),
    );
    expect(result.categorias).toHaveLength(1);
  });

  it('cria categoria', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      categoria: { id: 'c2', nome: 'Lazer', tipo: 'despesa', ativo: true },
    });

    const result = await service.criar({ nome: 'Lazer', tipo: 'despesa' }, 'familia-x-id');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/categorias',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.categoria.nome).toBe('Lazer');
  });

  it('desativa categoria', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      categoria: { id: 'c1', nome: 'Mercado', ativo: false },
    });

    await service.desativar('c1', 'familia-x-id');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/categorias/c1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('MetodoPagamentoService', () => {
  let apiClient: ApiClient;
  let service: MetodoPagamentoService;

  beforeEach(() => {
    apiClient = buildApiClient();
    service = new MetodoPagamentoService(apiClient);
  });

  it('lista métodos de pagamento', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ metodosPagamento: [] });
    await service.listar('fid');
    expect(apiClient.request).toHaveBeenCalledWith('/api/metodos-pagamento', expect.anything());
  });

  it('cria método de pagamento', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ metodoPagamento: { id: 'm1' } });
    await service.criar(
      { nome: 'Nubank', tipo: 'credito', dataFechamento: 15, dataVencimento: 22 },
      'fid',
    );
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/metodos-pagamento',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('desativa método', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      metodoPagamento: { id: 'm1', ativo: false },
    });
    await service.desativar('m1', 'fid');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/metodos-pagamento/m1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

describe('TransacaoService', () => {
  let apiClient: ApiClient;
  let service: TransacaoService;

  beforeEach(() => {
    apiClient = buildApiClient();
    service = new TransacaoService(apiClient);
  });

  it('lista transações com filtros', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ transacoes: [] });
    await service.listar({ mesReferencia: '2026-03' }, 'fid');
    expect(apiClient.request).toHaveBeenCalledWith(
      expect.stringContaining('/api/transacoes'),
      expect.anything(),
    );
  });

  it('registra transação', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ transacao: { id: 't1' } });
    await service.registrar(
      {
        tipo: 'despesa',
        valor: '100.00',
        categoriaId: 'c1',
        data: '2026-03-10',
        parcelado: false,
        recorrente: false,
      },
      'fid',
    );
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/transacoes',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('exclui transação', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce(undefined);
    await service.excluir('t1', 'fid');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/transacoes/t1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
