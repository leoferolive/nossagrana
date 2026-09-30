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
});
