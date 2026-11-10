import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@nossagrana/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiClient } from './api-client';
import {
  categoriaService,
  gravarAccessTokenSeHouverSessao,
  metodoPagamentoService,
  transacaoService,
} from './core-financeiro.service';
import { AuthService, FamiliaService } from './auth.service';

const buildApiClient = (
  overrides?: Partial<
    Pick<ApiClient, 'request' | 'aguardarRefresh' | 'encerrarSessao' | 'retomarSessao'>
  >,
) =>
  ({
    request: vi.fn(),
    aguardarRefresh: vi.fn().mockResolvedValue(undefined),
    encerrarSessao: vi.fn(),
    retomarSessao: vi.fn(),
    ...overrides,
  }) as Pick<
    ApiClient,
    'request' | 'aguardarRefresh' | 'encerrarSessao' | 'retomarSessao'
  > as ApiClient;

describe('AuthService', () => {
  let apiClient: ApiClient;
  let service: AuthService;

  beforeEach(() => {
    apiClient = buildApiClient();
    service = new AuthService(apiClient);
  });

  it('login faz POST /api/auth/login com payload', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce({ accessToken: 'at' });

    const payload = { email: 'user@test.com', senha: 'senhaSegura123' };
    const result = await service.login(payload);

    expect(apiClient.request).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        credentials: 'include',
        skipAuthRetry: true,
      }),
    );
    const { headers } = vi.mocked(apiClient.request).mock.calls[0][1] as RequestInit;
    expect(new Headers(headers).get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
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

  it('logout faz POST /api/auth/logout só com cookie + CSRF, sem corpo nem token', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce(undefined);

    await service.logout();

    const [path, init] = vi.mocked(apiClient.request).mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/auth/logout');
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
  });
});

describe('AuthService.logout x refresh em voo (#116)', () => {
  it('espera o refresh em andamento terminar antes de enviar o logout (revoga o cookie vigente)', async () => {
    const ordem: string[] = [];
    let terminarRefresh!: () => void;
    const apiClient = buildApiClient({
      aguardarRefresh: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            terminarRefresh = () => {
              ordem.push('refresh-terminou');
              resolve();
            };
          }),
      ),
      request: vi.fn(async () => {
        ordem.push('logout-enviado');
      }) as ApiClient['request'],
    });

    vi.mocked(apiClient.encerrarSessao).mockImplementation(() => {
      ordem.push('sessao-encerrada');
    });
    const logout = new AuthService(apiClient).logout();
    await Promise.resolve();
    expect(apiClient.request).not.toHaveBeenCalled();
    terminarRefresh();
    await logout;

    expect(ordem).toEqual(['sessao-encerrada', 'refresh-terminou', 'logout-enviado']);
  });
});

describe('AuthService.login x logout pendente (#116)', () => {
  const montar = (logoutFalha = false) => {
    const postados: string[] = [];
    let terminarRefresh!: () => void;
    const apiClient = buildApiClient({
      aguardarRefresh: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            terminarRefresh = resolve;
          }),
      ),
      request: vi.fn(async (path: string) => {
        postados.push(path);
        if (path === '/api/auth/logout' && logoutFalha) throw new Error('500');
        return { accessToken: 'at' };
      }) as ApiClient['request'],
    });
    return { service: new AuthService(apiClient), postados, liberar: () => terminarRefresh() };
  };
  const credenciais = { email: 'a@b.c', senha: 'senha12345' };

  it('o POST de login só sai depois do POST de logout (o cookie novo não é revogado)', async () => {
    const { service, postados, liberar } = montar();

    const logout = service.logout();
    const login = service.login(credenciais);
    await Promise.resolve();
    expect(postados).toEqual([]);
    liberar();
    await Promise.all([logout, login]);

    expect(postados).toEqual(['/api/auth/logout', '/api/auth/login']);
  });

  it('erro no logout pendente não impede o login', async () => {
    const { service, postados, liberar } = montar(true);

    const logout = service.logout().catch(() => undefined);
    const login = service.login(credenciais);
    liberar();
    await logout;

    await expect(login).resolves.toEqual({ accessToken: 'at' });
    expect(postados).toEqual(['/api/auth/logout', '/api/auth/login']);
  });

  it('sem logout pendente o login sai imediatamente, e a referência é limpa após o logout', async () => {
    const { service, postados, liberar } = montar();
    const logout = service.logout();
    liberar();
    await logout;

    await service.login(credenciais);

    expect(postados).toEqual(['/api/auth/logout', '/api/auth/login']);
  });
});

describe('AuthService.login retoma a sessão (#116)', () => {
  it('login bem-sucedido libera refreshes de novo; falho não', async () => {
    const apiClient = buildApiClient();
    const service = new AuthService(apiClient);
    vi.mocked(apiClient.request).mockRejectedValueOnce(new Error('401'));
    await expect(service.login({ email: 'a@b.c', senha: 'senha12345' })).rejects.toThrow();
    expect(apiClient.retomarSessao).not.toHaveBeenCalled();

    vi.mocked(apiClient.request).mockResolvedValueOnce({ accessToken: 'at' });
    await service.login({ email: 'a@b.c', senha: 'senha12345' });

    expect(apiClient.retomarSessao).toHaveBeenCalledTimes(1);
  });
});

describe('setAccessToken do client singleton (#116)', () => {
  afterEach(() => localStorage.clear());

  it('não recria a sessão quando um refresh termina depois do logout', () => {
    gravarAccessTokenSeHouverSessao('token-tardio');

    expect(localStorage.getItem('nossagrana.auth.session')).toBeNull();
  });

  it('atualiza o access token quando há sessão armazenada', () => {
    localStorage.setItem(
      'nossagrana.auth.session',
      JSON.stringify({ accessToken: 'velho', familiaIdAtiva: 'f1' }),
    );

    gravarAccessTokenSeHouverSessao('novo');

    expect(JSON.parse(localStorage.getItem('nossagrana.auth.session') ?? '{}')).toEqual({
      accessToken: 'novo',
      familiaIdAtiva: 'f1',
    });
  });
});

describe('FamiliaService', () => {
  let apiClient: ApiClient;
  let service: FamiliaService;

  beforeEach(() => {
    apiClient = buildApiClient();
    service = new FamiliaService(apiClient);
  });

  it('listarMinhas faz GET /api/familias/minhas', async () => {
    const mockResponse = {
      familias: [{ id: 'f1', nome: 'Familia Silva', role: 'admin', dataEntrada: '2026-01-01' }],
    };
    vi.mocked(apiClient.request).mockResolvedValueOnce(mockResponse);

    const result = await service.listarMinhas();

    expect(apiClient.request).toHaveBeenCalledWith('/api/familias/minhas');
    expect(result).toEqual(mockResponse);
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
