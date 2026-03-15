import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from './api-client';
import {
  CategoriaService,
  DashboardService,
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
      expect.stringContaining('mesReferencia=2026-03'),
      expect.anything(),
    );
  });

  it('lista transações com todos os filtros', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ transacoes: [] });
    await service.listar(
      {
        mesReferencia: '2026-03',
        tipo: 'despesa',
        categoriaId: 'c1',
        usuarioRegistrouId: 'u1',
        metodoPagamentoId: 'mp1',
      },
      'fid',
    );
    const url = vi.mocked(apiClient.request).mock.calls[0][0] as string;
    expect(url).toContain('tipo=despesa');
    expect(url).toContain('categoriaId=c1');
    expect(url).toContain('usuarioRegistrouId=u1');
    expect(url).toContain('metodoPagamentoId=mp1');
  });

  it('lista transações sem filtros usa url base', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ transacoes: [] });
    await service.listar({}, 'fid');
    expect(apiClient.request).toHaveBeenCalledWith('/api/transacoes', expect.anything());
  });

  it('busca detalhe de transação', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ transacao: { id: 't1' } });
    await service.detalhe('t1', 'fid');
    expect(apiClient.request).toHaveBeenCalledWith('/api/transacoes/t1', expect.anything());
  });

  it('edita transação', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ transacao: { id: 't1' } });
    await service.editar(
      't1',
      { tipo: 'despesa', valor: '200.00', categoriaId: 'c1', data: '2026-03-10' },
      'fid',
    );
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/transacoes/t1',
      expect.objectContaining({ method: 'PATCH' }),
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

describe('DashboardService', () => {
  let apiClient: ApiClient;
  let service: DashboardService;

  beforeEach(() => {
    apiClient = buildApiClient();
    service = new DashboardService(apiClient);
  });

  it('getDashboardResumo chama /api/dashboard', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});
    await service.getDashboardResumo('fid');
    expect(apiClient.request).toHaveBeenCalledWith('/api/dashboard', expect.anything());
  });

  it('getDashboardResumo inclui mesReferencia', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});
    await service.getDashboardResumo('fid', '2026-03');
    const url = vi.mocked(apiClient.request).mock.calls[0][0] as string;
    expect(url).toContain('mesReferencia=2026-03');
  });

  it('getDashboardGraficos chama /api/dashboard/graficos', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});
    await service.getDashboardGraficos('fid');
    expect(apiClient.request).toHaveBeenCalledWith('/api/dashboard/graficos', expect.anything());
  });

  it('getDashboardOrcamento chama /api/dashboard/orcamento', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({});
    await service.getDashboardOrcamento('fid');
    expect(apiClient.request).toHaveBeenCalledWith('/api/dashboard/orcamento', expect.anything());
  });

  it('getOrcamentos chama /api/orcamento sem qs quando sem mesReferencia', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ orcamentos: [] });
    await service.getOrcamentos('fid');
    expect(apiClient.request).toHaveBeenCalledWith('/api/orcamento', expect.anything());
  });

  it('getOrcamentos inclui mesReferencia na query string', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ orcamentos: [] });
    await service.getOrcamentos('fid', '2026-03');
    const url = vi.mocked(apiClient.request).mock.calls[0][0] as string;
    expect(url).toContain('mesReferencia=2026-03');
  });

  it('setOrcamento envia POST para /api/orcamento/:categoriaId', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ id: 'oc1' });
    await service.setOrcamento('fid', 'cat-1', {
      valorLimite: '500.00',
      vigenciaInicio: '2026-03',
    });
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/orcamento/cat-1',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('getOrcamentoHistorico chama /api/orcamento/:categoriaId/historico', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ historico: [] });
    await service.getOrcamentoHistorico('fid', 'cat-1');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/orcamento/cat-1/historico',
      expect.anything(),
    );
  });

  it('getRelatorioDistribuicao chama /api/relatorios/distribuicao', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ distribuicao: [] });
    await service.getRelatorioDistribuicao('fid');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/relatorios/distribuicao',
      expect.anything(),
    );
  });

  it('getRelatorioPorUsuario chama /api/relatorios/por-usuario', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ porUsuario: [] });
    await service.getRelatorioPorUsuario('fid');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/relatorios/por-usuario',
      expect.anything(),
    );
  });

  it('getRelatorioTendencias inclui meses na qs quando fornecido', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ meses: [] });
    await service.getRelatorioTendencias('fid', 6);
    const url = vi.mocked(apiClient.request).mock.calls[0][0] as string;
    expect(url).toContain('meses=6');
  });

  it('getRelatorioTendencias sem meses usa url base', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ meses: [] });
    await service.getRelatorioTendencias('fid');
    expect(apiClient.request).toHaveBeenCalledWith('/api/relatorios/tendencias', expect.anything());
  });

  it('getFatura chama /api/cartoes/:id/fatura/:mes', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ total: '0.00', transacoes: [] });
    await service.getFatura('fid', 'mp1', '2026-03');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/cartoes/mp1/fatura/2026-03',
      expect.anything(),
    );
  });

  it('getHistorico chama /api/historico com X-Familia-Id', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ meses: [] });
    await service.getHistorico('fid');
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/historico',
      expect.objectContaining({ headers: expect.anything() }),
    );
  });

  it('getHistoricoDetalhe chama /api/historico/:mesReferencia', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ mesReferencia: '2026-03' });
    await service.getHistoricoDetalhe('fid', '2026-03');
    expect(apiClient.request).toHaveBeenCalledWith('/api/historico/2026-03', expect.anything());
  });

  it('getPerfil chama /api/auth/perfil', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ nome: 'Leo', email: 'leo@example.com' });
    await service.getPerfil();
    expect(apiClient.request).toHaveBeenCalledWith('/api/auth/perfil');
  });

  it('updatePerfil envia PATCH para /api/auth/perfil com body', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      nome: 'Leo Atualizado',
      email: 'leo@example.com',
    });
    await service.updatePerfil({ nome: 'Leo Atualizado' });
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/auth/perfil',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ nome: 'Leo Atualizado' }),
      }),
    );
  });

  it('updateSenha envia PATCH para /api/auth/senha com body', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce(undefined);
    await service.updateSenha({ senhaAtual: 'oldPass', novaSenha: 'newPass' });
    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/auth/senha',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ senhaAtual: 'oldPass', novaSenha: 'newPass' }),
      }),
    );
  });
});
