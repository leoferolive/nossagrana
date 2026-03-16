import type { AuthRefreshRequest, AuthRefreshResponse } from '@nossagrana/types';

interface ApiClientOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

interface RequestOptions extends RequestInit {
  skipAuthRetry?: boolean;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly getAccessToken: () => string | null;
  private readonly getRefreshToken: () => string | null;
  private readonly setAccessToken: (accessToken: string) => void;
  private readonly clearSession: () => void;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken;
    this.getRefreshToken = options.getRefreshToken;
    this.setAccessToken = options.setAccessToken;
    this.clearSession = options.clearSession;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { skipAuthRetry = false, headers, ...requestOptions } = options;

    const accessToken = this.getAccessToken();
    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...requestOptions,
      headers: this.withAuthHeader(headers, accessToken),
    });

    if (response.status === 401 && !skipAuthRetry && path !== '/api/auth/refresh') {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.request<T>(path, { ...options, skipAuthRetry: true });
      }
    }

    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Nao autorizado' : 'Erro ao processar requisicao');
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearSession();
      return false;
    }

    const payload: AuthRefreshRequest = { refreshToken };
    const response = await this.fetchFn(`${this.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      this.clearSession();
      return false;
    }

    const body = (await response.json()) as AuthRefreshResponse;
    this.setAccessToken(body.accessToken);
    return true;
  }

  private withAuthHeader(
    headers: HeadersInit | undefined,
    accessToken: string | null,
  ): HeadersInit {
    const parsedHeaders = new Headers(headers);

    if (accessToken) {
      parsedHeaders.set('Authorization', `Bearer ${accessToken}`);
    }

    return parsedHeaders;
  }
}
