import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@nossagrana/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthSessionStore } from '../stores/auth-session.store';
import { FakeLockManager } from '../test/fake-lock-manager';

import { ApiClient, ApiError } from './api-client';

interface TokenState {
  accessToken: string | null;
}

describe('ApiClient', () => {
  let tokenState: TokenState;

  beforeEach(() => {
    tokenState = {
      accessToken: 'access-token-old',
    };
  });

  it('renews access token and retries request after 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'access-token-new' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: fetchMock,
      getAccessToken: () => tokenState.accessToken,
      setAccessToken: (accessToken) => {
        tokenState.accessToken = accessToken;
      },
      clearSession: () => {
        tokenState.accessToken = null;
      },
    });

    const result = await apiClient.request<{ ok: boolean }>('/dashboard');

    expect(result).toEqual({ ok: true });
    expect(tokenState.accessToken).toBe('access-token-new');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3000/api/auth/refresh');
    const requestHeaders = new Headers(fetchMock.mock.calls[2][1]?.headers);
    expect(requestHeaders.get('Authorization')).toBe('Bearer access-token-new');
  });

  it('refresh usa o cookie: credentials include + cabeçalho CSRF, sem refresh no corpo nem no storage', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: 'access-token-new' }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: fetchMock,
      getAccessToken: () => tokenState.accessToken,
      setAccessToken: (accessToken) => {
        tokenState.accessToken = accessToken;
      },
      clearSession: vi.fn(),
    });

    await apiClient.request('/api/dashboard');

    const [, refreshInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(refreshInit.credentials).toBe('include');
    expect(new Headers(refreshInit.headers).get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
    expect(refreshInit.body).toBe('{}');
    expect(localStorage.length).toBe(0);
  });

  it('requisições comuns não enviam credenciais (cookie só vai nos endpoints de auth)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: fetchMock,
      getAccessToken: () => tokenState.accessToken,
      setAccessToken: vi.fn(),
      clearSession: vi.fn(),
    });

    await apiClient.request('/api/dashboard');

    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].credentials).toBeUndefined();
  });

  it('401 sem sessão (ex.: login errado) não dispara refresh', async () => {
    tokenState.accessToken = null;
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: fetchMock,
      getAccessToken: () => tokenState.accessToken,
      setAccessToken: vi.fn(),
      clearSession: vi.fn(),
    });

    await expect(apiClient.request('/api/auth/login')).rejects.toThrow('Não autorizado');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aguardarRefresh resolve quando não há refresh em andamento e espera o em andamento', async () => {
    let liberar!: () => void;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/auth/refresh')) {
        return new Promise<Response>((resolve) => {
          liberar = () =>
            resolve(new Response(JSON.stringify({ accessToken: 'novo' }), { status: 200 }));
        });
      }
      const ok = tokenState.accessToken === 'novo';
      return Promise.resolve(new Response(ok ? '{}' : null, { status: ok ? 200 : 401 }));
    });
    const apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: fetchMock,
      getAccessToken: () => tokenState.accessToken,
      setAccessToken: (accessToken) => {
        tokenState.accessToken = accessToken;
      },
      clearSession: vi.fn(),
    });
    await apiClient.aguardarRefresh();

    const requisicao = apiClient.request('/api/a');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    let terminou = false;
    const espera = apiClient.aguardarRefresh().then(() => (terminou = true));
    await Promise.resolve();
    expect(terminou).toBe(false);
    liberar();
    await espera;
    await requisicao;

    expect(tokenState.accessToken).toBe('novo');
  });

  it.each([500, 503])(
    'refresh com %i não limpa a sessão local (o cookie segue válido)',
    async (status) => {
      const clearSession = vi.fn();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status }));
      const apiClient = new ApiClient({
        baseUrl: 'http://localhost:3000',
        fetchFn: fetchMock,
        getAccessToken: () => tokenState.accessToken,
        setAccessToken: vi.fn(),
        clearSession,
      });

      await expect(apiClient.request('/api/dashboard')).rejects.toThrow();

      expect(clearSession).not.toHaveBeenCalled();
    },
  );

  it.each([401, 403])('refresh com %i limpa a sessão', async (status) => {
    const clearSession = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status }));
    const apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: fetchMock,
      getAccessToken: () => tokenState.accessToken,
      setAccessToken: vi.fn(),
      clearSession,
    });

    await expect(apiClient.request('/api/dashboard')).rejects.toThrow();

    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  describe('logout x requisição em voo (#116)', () => {
    const montar = () => {
      let liberar401!: () => void;
      const fetchMock = vi.fn((input: RequestInfo | URL) => {
        if (String(input).endsWith('/api/auth/refresh')) {
          return Promise.resolve(
            new Response(JSON.stringify({ accessToken: 'novo' }), { status: 200 }),
          );
        }
        return new Promise<Response>((resolve) => {
          liberar401 = () => resolve(new Response(null, { status: 401 }));
        });
      });
      const apiClient = new ApiClient({
        baseUrl: 'http://localhost:3000',
        fetchFn: fetchMock,
        getAccessToken: () => tokenState.accessToken,
        setAccessToken: (accessToken) => {
          tokenState.accessToken = accessToken;
        },
        clearSession: vi.fn(),
      });
      return { apiClient, fetchMock, liberar: () => liberar401() };
    };
    const refreshCalls = (fetchMock: ReturnType<typeof montar>['fetchMock']) =>
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/api/auth/refresh'));

    it('401 atrasado depois do logout não dispara refresh', async () => {
      const { apiClient, fetchMock, liberar } = montar();
      const lenta = apiClient.request('/api/lenta');
      apiClient.encerrarSessao();
      tokenState.accessToken = null;

      liberar();

      await expect(lenta).rejects.toThrow('Não autorizado');
      expect(refreshCalls(fetchMock)).toHaveLength(0);
    });

    it('sem access token atual no 401 (sessão já limpa) não dispara refresh', async () => {
      const { apiClient, fetchMock, liberar } = montar();
      const lenta = apiClient.request('/api/lenta');
      tokenState.accessToken = null;

      liberar();

      await expect(lenta).rejects.toThrow('Não autorizado');
      expect(refreshCalls(fetchMock)).toHaveLength(0);
    });

    it('encerrarSessao bloqueia refresh mesmo com token presente; retomarSessao libera de novo', async () => {
      const { apiClient, fetchMock, liberar } = montar();
      apiClient.encerrarSessao();
      const bloqueada = apiClient.request('/api/a');
      liberar();
      await expect(bloqueada).rejects.toThrow();
      expect(refreshCalls(fetchMock)).toHaveLength(0);

      apiClient.retomarSessao();
      void apiClient.request('/api/b').catch(() => undefined);
      liberar();
      await vi.waitFor(() => expect(refreshCalls(fetchMock)).toHaveLength(1));
    });
  });

  it('clears session when refresh token is invalid', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 401,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Refresh token invalido' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: fetchMock,
      getAccessToken: () => tokenState.accessToken,
      setAccessToken: (accessToken) => {
        tokenState.accessToken = accessToken;
      },
      clearSession: () => {
        tokenState.accessToken = null;
      },
    });

    await expect(apiClient.request('/dashboard')).rejects.toThrow('Não autorizado');
    expect(tokenState.accessToken).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('429 expõe o Retry-After (em ms) no ApiError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429, headers: { 'Retry-After': '7' } }));
    const apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: fetchMock,
      getAccessToken: () => tokenState.accessToken,
      setAccessToken: vi.fn(),
      clearSession: vi.fn(),
    });

    const erro = await apiClient.request('/dashboard').catch((err: unknown) => err);

    expect(erro).toBeInstanceOf(ApiError);
    expect(erro).toMatchObject({ status: 429, retryAfterMs: 7000 });
  });

  it('erro sem Retry-After (ou inválido) deixa retryAfterMs indefinido', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 429, headers: { 'Retry-After': 'logo' } }));
    const apiClient = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: fetchMock,
      getAccessToken: () => tokenState.accessToken,
      setAccessToken: vi.fn(),
      clearSession: vi.fn(),
    });

    const erro = await apiClient.request('/dashboard').catch((err: unknown) => err);

    expect(erro).toMatchObject({ status: 429, retryAfterMs: undefined });
  });

  describe('single-flight do refresh', () => {
    const buildClient = (server: FakeAuthServer) => {
      const state: TokenState = { accessToken: 'access-old' };
      const clearSession = vi.fn(() => {
        state.accessToken = null;
      });
      const client = new ApiClient({
        baseUrl: 'http://localhost:3000',
        fetchFn: server.fetch,
        getAccessToken: () => state.accessToken,
        setAccessToken: (token) => {
          state.accessToken = token;
        },
        clearSession,
      });
      return { client, state, clearSession };
    };

    it('N requisições simultâneas com 401 fazem um único POST /api/auth/refresh', async () => {
      const server = new FakeAuthServer();
      const { client, state } = buildClient(server);

      const results = await Promise.all([
        client.request<{ ok: boolean }>('/api/a'),
        client.request<{ ok: boolean }>('/api/b'),
        client.request<{ ok: boolean }>('/api/c'),
        client.request<{ ok: boolean }>('/api/d'),
      ]);

      expect(server.refreshCalls).toBe(1);
      expect(server.reuseDetected).toBe(false);
      expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
      expect(state.accessToken).toBe('access-2');
      expect(server.retriesWithToken).toEqual(['access-2', 'access-2', 'access-2', 'access-2']);
    });

    it('falha do refresh derruba todas as requisições e limpa a sessão uma única vez', async () => {
      const server = new FakeAuthServer({ refreshFails: true });
      const { client, clearSession } = buildClient(server);

      const results = await Promise.allSettled([
        client.request('/api/a'),
        client.request('/api/b'),
        client.request('/api/c'),
      ]);

      expect(server.refreshCalls).toBe(1);
      expect(server.reuseDetected).toBe(false);
      expect(clearSession).toHaveBeenCalledTimes(1);
      expect(results.every((r) => r.status === 'rejected')).toBe(true);
    });

    it('um refresh posterior, após o anterior terminar, dispara nova chamada', async () => {
      const server = new FakeAuthServer();
      const { client, state } = buildClient(server);

      await client.request('/api/a');
      server.expireAccessToken();
      await client.request('/api/b');

      expect(server.refreshCalls).toBe(2);
      expect(state.accessToken).toBe('access-3');
    });

    it('requisição que recebe 401 após o refresh de outra já ter terminado reaproveita o novo token', async () => {
      const server = new FakeAuthServer({ delayedStaleResponse: true });
      const { client } = buildClient(server);

      const lenta = client.request('/api/lenta');
      await client.request('/api/rapida');
      server.releaseStale();
      const resultado = await lenta;

      expect(resultado).toEqual({ ok: true });
      expect(server.refreshCalls).toBe(1);
      expect(server.reuseDetected).toBe(false);
      expect(server.retriesWithToken.at(-1)).toBe('access-2');
    });

    it('erro de rede no refresh falha as requisições, não trava o single-flight e permite novo refresh', async () => {
      const server = new FakeAuthServer({ refreshThrows: true });
      const { client, state } = buildClient(server);

      const results = await Promise.allSettled([
        client.request('/api/a'),
        client.request('/api/b'),
      ]);

      expect(server.refreshCalls).toBe(1);
      expect(results.every((r) => r.status === 'rejected')).toBe(true);

      server.recoverNetwork();
      await expect(client.request('/api/c')).resolves.toEqual({ ok: true });

      expect(server.refreshCalls).toBe(2);
      expect(server.reuseDetected).toBe(false);
      expect(state.accessToken).toBe('access-2');
    });
  });
});

interface FakeAuthServerOptions {
  refreshFails?: boolean;
  /** O fetch do refresh lança erro de rede (TypeError) até `recoverNetwork()`. */
  refreshThrows?: boolean;
  /** A primeira requisição `/api/lenta` fica pendurada até `releaseStale()` e responde 401. */
  delayedStaleResponse?: boolean;
}

/** Fake do servidor de auth: access válido é o último emitido; refresh conta chamadas. */
class FakeAuthServer {
  refreshCalls = 0;
  /** Verdadeiro se um refresh token já usado foi reapresentado (o que revogaria as sessões). */
  reuseDetected = false;
  readonly retriesWithToken: string[] = [];
  private validAccess = 'access-1';
  private issued = 1;
  private releaseSlow: (() => void) | null = null;
  private slowServed = false;
  private networkDown: boolean;
  /** Cookie de refresh vigente no "navegador" (HttpOnly: o client nunca o vê). */
  private cookieJar: string | null = 'refresh-1';
  private readonly usedRefresh = new Set<string>();

  constructor(private readonly options: FakeAuthServerOptions = {}) {
    this.networkDown = options.refreshThrows ?? false;
  }

  recoverNetwork(): void {
    this.networkDown = false;
  }

  expireAccessToken(): void {
    this.validAccess = 'expired';
  }

  releaseStale(): void {
    this.releaseSlow?.();
  }

  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/api/auth/refresh')) return this.handleRefresh(init);
    const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '') ?? '';
    if (this.options.delayedStaleResponse && url.endsWith('/api/lenta') && !this.slowServed) {
      this.slowServed = true;
      await this.waitForRelease();
      return new Response(null, { status: 401 });
    }
    return this.handleResource(token);
  };

  private waitForRelease(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.releaseSlow = resolve;
    });
  }

  private handleResource(token: string): Response {
    if (token !== this.validAccess) return new Response(null, { status: 401 });
    this.retriesWithToken.push(token);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleRefresh(init?: RequestInit): Promise<Response> {
    this.refreshCalls += 1;
    await Promise.resolve();
    if (this.networkDown) throw new TypeError('Failed to fetch');
    if (this.options.refreshFails) return new Response(null, { status: 401 });
    // O refresh vive no cookie HttpOnly: só chega se a requisição pediu credenciais e o CSRF.
    const enviouCookie = init?.credentials === 'include';
    const enviouCsrf = new Headers(init?.headers).get(CSRF_HEADER_NAME) === CSRF_HEADER_VALUE;
    if (!enviouCookie || !enviouCsrf || !this.cookieJar) return new Response(null, { status: 401 });
    if (this.usedRefresh.has(this.cookieJar)) {
      this.reuseDetected = true;
      return new Response(null, { status: 401 });
    }
    this.usedRefresh.add(this.cookieJar);
    this.issued += 1;
    this.validAccess = `access-${this.issued}`;
    this.cookieJar = `refresh-${this.issued}`;
    return new Response(JSON.stringify({ accessToken: this.validAccess }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

describe('ApiClient com o store de sessão em memória (#117)', () => {
  const respostaJson = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status });

  const criarClient = (fetchFn: typeof fetch) =>
    new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn,
      getAccessToken: () => useAuthSessionStore.getState().accessToken,
      setAccessToken: (token) => useAuthSessionStore.getState().atualizarAccessToken(token),
      clearSession: () => useAuthSessionStore.getState().encerrarSessao(),
    });

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthSessionStore.getState().iniciarSessao('access-velho', '');
  });

  it('401 simultâneos disparam um único refresh e o token novo fica só em memória', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith('/api/auth/refresh')) return respostaJson({ accessToken: 'novo' });
      const auth = new Headers(init?.headers).get('Authorization');
      return auth === 'Bearer novo'
        ? respostaJson({ ok: true })
        : new Response(null, { status: 401 });
    });
    const client = criarClient(fetchMock as unknown as typeof fetch);

    await Promise.all([
      client.request('/api/a'),
      client.request('/api/b'),
      client.request('/api/c'),
    ]);

    const refreshes = fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/api/auth/refresh'));
    expect(refreshes).toHaveLength(1);
    expect(useAuthSessionStore.getState().accessToken).toBe('novo');
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('restaurarSessao (bootstrap) usa o cookie, guarda o token em memória e compartilha o single-flight', async () => {
    useAuthSessionStore.setState({ status: 'carregando', accessToken: null, familiaIdAtiva: null });
    const fetchMock = vi.fn(async () => respostaJson({ accessToken: 'restaurado' }));
    const client = criarClient(fetchMock as unknown as typeof fetch);

    const [a, b] = await Promise.all([client.restaurarSessao(), client.restaurarSessao()]);

    expect([a, b]).toEqual(['ok', 'ok']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get(CSRF_HEADER_NAME)).toBe(CSRF_HEADER_VALUE);
    expect(useAuthSessionStore.getState().accessToken).toBe('restaurado');
  });

  it.each([401, 403])(
    'restaurarSessao com %i limpa a sessão e retorna sem-sessao',
    async (status) => {
      useAuthSessionStore.setState({
        status: 'carregando',
        accessToken: null,
        familiaIdAtiva: null,
      });
      const fetchNegado = vi.fn(async () => new Response(null, { status }));

      await expect(
        criarClient(fetchNegado as unknown as typeof fetch).restaurarSessao(),
      ).resolves.toBe('sem-sessao');
      expect(useAuthSessionStore.getState().status).toBe('anonimo');
    },
  );

  it.each([500, 503, 429])(
    'restaurarSessao com %i é indisponível e não limpa a sessão',
    async (status) => {
      useAuthSessionStore.setState({
        status: 'carregando',
        accessToken: null,
        familiaIdAtiva: null,
      });
      const clearSession = vi.fn();
      const client = new ApiClient({
        baseUrl: 'http://localhost:3000',
        fetchFn: (async () => new Response(null, { status })) as unknown as typeof fetch,
        getAccessToken: () => null,
        setAccessToken: vi.fn(),
        clearSession,
      });

      await expect(client.restaurarSessao()).resolves.toBe('indisponivel');
      expect(clearSession).not.toHaveBeenCalled();
    },
  );

  it('rede offline (fetch rejeita) é indisponível, sem clearSession', async () => {
    const clearSession = vi.fn();
    const client = new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
      getAccessToken: () => null,
      setAccessToken: vi.fn(),
      clearSession,
    });

    await expect(client.restaurarSessao()).resolves.toBe('indisponivel');
    expect(clearSession).not.toHaveBeenCalled();
  });

  describe('timeout do refresh (I1)', () => {
    afterEach(() => vi.useRealTimers());

    it('fetch de refresh que nunca resolve é abortado após 10 s: indisponível, lock liberado, sem clearSession', async () => {
      vi.useFakeTimers();
      const clearSession = vi.fn();
      const fetchPendurado = vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('abort', 'AbortError')),
            );
          }),
      );
      const locks = new FakeLockManager();
      const client = new ApiClient({
        baseUrl: 'http://localhost:3000',
        fetchFn: fetchPendurado as unknown as typeof fetch,
        getAccessToken: () => null,
        setAccessToken: vi.fn(),
        clearSession,
        locks,
      });

      const resultado = client.restaurarSessao();
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(resultado).resolves.toBe('indisponivel');
      expect(clearSession).not.toHaveBeenCalled();
      // O lock foi liberado: um segundo uso do lock não trava.
      await expect(locks.request('nossagrana-refresh', async () => 'livre')).resolves.toBe('livre');
    });
  });

  describe('indisponibilidade durante o uso normal (#117)', () => {
    const montar = (refresh: () => Promise<Response>) => {
      const clearSession = vi.fn();
      const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
        String(url).endsWith('/api/auth/refresh') ? refresh() : new Response(null, { status: 401 }),
      );
      const client = new ApiClient({
        baseUrl: 'http://localhost:3000',
        fetchFn: fetchMock as unknown as typeof fetch,
        getAccessToken: () => 'at',
        setAccessToken: vi.fn(),
        clearSession,
      });
      return { client, clearSession };
    };

    it('refresh 5xx após 401 lança ApiError 503 (transitório), não 401', async () => {
      const { client, clearSession } = montar(async () => new Response(null, { status: 500 }));

      await expect(client.request('/api/dashboard')).rejects.toMatchObject({ status: 503 });
      expect(clearSession).not.toHaveBeenCalled();
    });

    it('refresh 401 real mantém ApiError 401 (sessão inválida)', async () => {
      const { client } = montar(async () => new Response(null, { status: 401 }));

      await expect(client.request('/api/dashboard')).rejects.toMatchObject({ status: 401 });
    });

    it('JSON inválido na resposta do refresh vira indisponível, sem rejeitar', async () => {
      const { client, clearSession } = montar(async () => new Response('<html>', { status: 200 }));

      await expect(client.restaurarSessao()).resolves.toBe('indisponivel');
      expect(clearSession).not.toHaveBeenCalled();
    });
  });

  describe('timeout em requisições dentro do lock (#117)', () => {
    afterEach(() => vi.useRealTimers());

    it('corpo que nunca resolve (headers já recebidos) também estoura o timeout e libera o lock', async () => {
      vi.useFakeTimers();
      const corpoPendurado = {
        ok: true,
        status: 200,
        json: () => new Promise<never>(() => undefined),
      } as unknown as Response;
      const locks = new FakeLockManager();
      const client = new ApiClient({
        baseUrl: 'http://localhost:3000',
        fetchFn: vi.fn(async () => corpoPendurado) as unknown as typeof fetch,
        getAccessToken: () => null,
        setAccessToken: vi.fn(),
        clearSession: vi.fn(),
        locks,
      });

      const sob = locks.request('nossagrana-refresh', () =>
        client.request('/api/auth/login', { method: 'POST', timeoutMs: 10_000 }),
      );
      const verificado = expect(sob).rejects.toBeDefined();
      await vi.advanceTimersByTimeAsync(10_000);

      await verificado;
      await expect(locks.request('nossagrana-refresh', async () => 'livre')).resolves.toBe('livre');
    });

    it('timeoutMs aborta o fetch pendurado e a promise rejeita', async () => {
      vi.useFakeTimers();
      const fetchPendurado = vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('abort', 'AbortError')),
            );
          }),
      );
      const client = new ApiClient({
        baseUrl: 'http://localhost:3000',
        fetchFn: fetchPendurado as unknown as typeof fetch,
        getAccessToken: () => null,
        setAccessToken: vi.fn(),
        clearSession: vi.fn(),
      });

      const resultado = client.request('/api/auth/login', { method: 'POST', timeoutMs: 10_000 });
      const verificado = expect(resultado).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(10_000);
      await verificado;
    });
  });

  it('logout (encerrarSessao) limpa a memória e um refresh tardio não recria a sessão', async () => {
    let liberar: () => void = () => undefined;
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (!String(url).endsWith('/api/auth/refresh')) return new Response(null, { status: 401 });
      await new Promise<void>((r) => (liberar = r));
      return respostaJson({ accessToken: 'tardio' });
    });
    const client = criarClient(fetchMock as unknown as typeof fetch);

    const pedido = client.request('/api/a').catch(() => undefined);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    useAuthSessionStore.getState().encerrarSessao();
    liberar();
    await pedido;

    expect(useAuthSessionStore.getState().accessToken).toBeNull();
  });
});
