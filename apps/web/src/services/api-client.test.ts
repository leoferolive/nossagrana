import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClient, ApiError } from './api-client';

interface TokenState {
  accessToken: string | null;
  refreshToken: string | null;
}

describe('ApiClient', () => {
  let tokenState: TokenState;

  beforeEach(() => {
    tokenState = {
      accessToken: 'access-token-old',
      refreshToken: 'refresh-token-valid',
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
        new Response(
          JSON.stringify({ accessToken: 'access-token-new', refreshToken: 'refresh-token-new' }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
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
      getRefreshToken: () => tokenState.refreshToken,
      setAccessToken: (accessToken) => {
        tokenState.accessToken = accessToken;
      },
      setRefreshToken: (refreshToken) => {
        tokenState.refreshToken = refreshToken;
      },
      clearSession: () => {
        tokenState.accessToken = null;
        tokenState.refreshToken = null;
      },
    });

    const result = await apiClient.request<{ ok: boolean }>('/dashboard');

    expect(result).toEqual({ ok: true });
    expect(tokenState.accessToken).toBe('access-token-new');
    expect(tokenState.refreshToken).toBe('refresh-token-new');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:3000/api/auth/refresh');
    const requestHeaders = new Headers(fetchMock.mock.calls[2][1]?.headers);
    expect(requestHeaders.get('Authorization')).toBe('Bearer access-token-new');
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
      getRefreshToken: () => tokenState.refreshToken,
      setAccessToken: (accessToken) => {
        tokenState.accessToken = accessToken;
      },
      setRefreshToken: (refreshToken) => {
        tokenState.refreshToken = refreshToken;
      },
      clearSession: () => {
        tokenState.accessToken = null;
        tokenState.refreshToken = null;
      },
    });

    await expect(apiClient.request('/dashboard')).rejects.toThrow('Não autorizado');
    expect(tokenState.accessToken).toBeNull();
    expect(tokenState.refreshToken).toBeNull();
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
      getRefreshToken: () => tokenState.refreshToken,
      setAccessToken: vi.fn(),
      setRefreshToken: vi.fn(),
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
      getRefreshToken: () => tokenState.refreshToken,
      setAccessToken: vi.fn(),
      setRefreshToken: vi.fn(),
      clearSession: vi.fn(),
    });

    const erro = await apiClient.request('/dashboard').catch((err: unknown) => err);

    expect(erro).toMatchObject({ status: 429, retryAfterMs: undefined });
  });

  describe('single-flight do refresh', () => {
    const buildClient = (server: FakeAuthServer) => {
      const state: TokenState = { accessToken: 'access-old', refreshToken: 'refresh-1' };
      const clearSession = vi.fn(() => {
        state.accessToken = null;
        state.refreshToken = null;
      });
      const client = new ApiClient({
        baseUrl: 'http://localhost:3000',
        fetchFn: server.fetch,
        getAccessToken: () => state.accessToken,
        getRefreshToken: () => state.refreshToken,
        setAccessToken: (token) => {
          state.accessToken = token;
        },
        setRefreshToken: (token) => {
          state.refreshToken = token;
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
  private currentRefresh = 'refresh-1';
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
    const { refreshToken } = JSON.parse(String(init?.body)) as { refreshToken: string };
    if (this.usedRefresh.has(refreshToken) || refreshToken !== this.currentRefresh) {
      this.reuseDetected = true;
      return new Response(null, { status: 401 });
    }
    this.usedRefresh.add(refreshToken);
    this.issued += 1;
    this.validAccess = `access-${this.issued}`;
    this.currentRefresh = `refresh-${this.issued}`;
    return new Response(
      JSON.stringify({ accessToken: this.validAccess, refreshToken: this.currentRefresh }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
