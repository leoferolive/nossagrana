import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from './api-client';
import {
  categoriaService,
  metodoPagamentoService,
  transacaoService,
} from './core-financeiro.service';
import { AuthService, FamiliaService } from './auth.service';

const buildApiClient = (overrides?: Partial<Pick<ApiClient, 'request'>>) =>
  ({
    request: vi.fn(),
    ...overrides,
  }) as Pick<ApiClient, 'request'> as ApiClient;

describe('AuthService', () => {
  let apiClient: ApiClient;
  let service: AuthService;

  beforeEach(() => {
    apiClient = buildApiClient();
    service = new AuthService(apiClient);
  });

  it('login faz POST /api/auth/login com payload', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      accessToken: 'at',
      refreshToken: 'rt',
    });

    const payload = { email: 'user@test.com', senha: 'senhaSegura123' };
    const result = await service.login(payload);

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
    expect(result.accessToken).toBe('at');
  });

  it('register faz POST /api/auth/register com payload', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      user: { id: 'u1', nome: 'Leo', email: 'leo@test.com', dataCriacao: '2026-01-01' },
    });

    const payload = { nome: 'Leo', email: 'leo@test.com', senha: 'senhaSegura123' };
    await service.register(payload);

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
  });

  it('logout faz POST /api/auth/logout com { refreshToken }', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce(undefined);

    await service.logout('my-refresh-token');

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'my-refresh-token' }),
      }),
    );
  });
});

describe('FamiliaService', () => {
  let apiClient: ApiClient;
  let service: FamiliaService;

  beforeEach(() => {
    apiClient = buildApiClient();
    service = new FamiliaService(apiClient);
  });

  it('criar faz POST /api/familias com payload', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      familia: { id: 'f1', nome: 'Família Silva', dataCriacao: '2026-01-01' },
    });

    await service.criar({ nome: 'Família Silva' });

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/familias',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ nome: 'Família Silva' }),
      }),
    );
  });

  it('alternar faz POST /api/familias/alternar com { familiaId }', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ familiaIdAtiva: 'f2' });

    await service.alternar('f2');

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/familias/alternar',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ familiaId: 'f2' }),
      }),
    );
  });

  it('listarMembros faz GET /api/familias/:id/membros com header X-Familia-Id', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ membros: [] });

    await service.listarMembros('f1');

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/familias/f1/membros',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Familia-Id': 'f1' }),
      }),
    );
  });

  it('buscar faz GET /api/familias/buscar?nome=...', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ familias: [] });

    await service.buscar('Silva');

    expect(apiClient.request).toHaveBeenCalledWith(
      `/api/familias/buscar?nome=${encodeURIComponent('Silva')}`,
    );
  });

  it('entrarPorConvite faz POST /api/familias/entrar/:codigo com body {}', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      familia: { id: 'f1', nome: 'Test', dataCriacao: '2026-01-01' },
    });

    await service.entrarPorConvite('ABC123');

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/familias/entrar/ABC123',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
  });

  it('solicitarEntrada faz POST /api/familias/solicitar com { familiaId }', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      solicitacao: {
        id: 's1',
        familiaId: 'f1',
        usuarioId: 'u1',
        status: 'pendente',
        solicitadoEm: '2026-01-01',
      },
    });

    await service.solicitarEntrada('f1');

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/familias/solicitar',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ familiaId: 'f1' }),
      }),
    );
  });

  it('gerarConvite faz POST /api/familias/convites com header X-Familia-Id e body {}', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      convite: {
        id: 'c1',
        familiaId: 'f1',
        codigo: 'XYZ',
        expiraEm: '2026-02-01',
        criadoPor: 'u1',
        dataCriacao: '2026-01-01',
      },
    });

    await service.gerarConvite('f1');

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/familias/convites',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({}),
        headers: expect.objectContaining({ 'X-Familia-Id': 'f1' }),
      }),
    );
  });

  it('revisarSolicitacao faz PATCH /api/familias/solicitacoes/:id com { acao } e header X-Familia-Id', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({
      solicitacao: {
        id: 's1',
        familiaId: 'f1',
        usuarioId: 'u1',
        status: 'aprovada',
        solicitadoEm: '2026-01-01',
        respondidoEm: '2026-01-02',
        respondidoPor: 'u2',
      },
    });

    await service.revisarSolicitacao('s1', 'aprovar', 'f1');

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/familias/solicitacoes/s1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ acao: 'aprovar' }),
        headers: expect.objectContaining({ 'X-Familia-Id': 'f1' }),
      }),
    );
  });

  it('removerMembro faz DELETE /api/familias/:id/membros/:usuarioId com header X-Familia-Id', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce(undefined);

    await service.removerMembro('f1', 'u1');

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/familias/f1/membros/u1',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'X-Familia-Id': 'f1' }),
      }),
    );
  });

  it('listarSolicitacoes faz GET /api/familias/solicitacoes com header X-Familia-Id', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ solicitacoes: [] });

    await service.listarSolicitacoes('f1');

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/familias/solicitacoes',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Familia-Id': 'f1' }),
      }),
    );
  });
});

describe('Exports de core-financeiro.service.ts', () => {
  it('categoriaService é exportado', () => {
    expect(categoriaService).toBeDefined();
  });

  it('metodoPagamentoService é exportado', () => {
    expect(metodoPagamentoService).toBeDefined();
  });

  it('transacaoService é exportado', () => {
    expect(transacaoService).toBeDefined();
  });

  it('exporta lazyApiClient', async () => {
    const mod = await import('./core-financeiro.service');
    expect(mod.lazyApiClient).toBeDefined();
  });
});
