import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClient } from './api-client';

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
      getRefreshToken: () => tokenState.refreshToken,
      setAccessToken: (accessToken) => {
        tokenState.accessToken = accessToken;
      },
      clearSession: () => {
        tokenState.accessToken = null;
        tokenState.refreshToken = null;
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
      clearSession: () => {
        tokenState.accessToken = null;
        tokenState.refreshToken = null;
      },
    });

    await expect(apiClient.request('/dashboard')).rejects.toThrow('Nao autorizado');
    expect(tokenState.accessToken).toBeNull();
    expect(tokenState.refreshToken).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
