import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '@nossagrana/types';
import type { AuthRefreshResponse } from '@nossagrana/types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Espera pedida pelo servidor (`Retry-After`, em ms), p.ex. no 429 do rate limit. */
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** `Retry-After` em segundos inteiros (o formato que o rate limit da API envia); outro formato vira `undefined`. */
function lerRetryAfterMs(response: Response): number | undefined {
  const segundos = Number(response.headers.get('Retry-After'));
  return Number.isFinite(segundos) && segundos > 0 ? Math.round(segundos * 1000) : undefined;
}

interface ApiClientOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  getAccessToken: () => string | null;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
}

interface RequestOptions extends RequestInit {
  skipAuthRetry?: boolean;
}

/**
 * Opções dos endpoints que usam o cookie HttpOnly de refresh (login, refresh, logout, #116):
 * `include` para o navegador enviar/aceitar o cookie (também em dev cross-origin) e o
 * cabeçalho CSRF. As demais requisições não levam credenciais.
 */
export function cookieAuthInit(headers: HeadersInit = {}): RequestInit {
  const comCsrf = new Headers(headers);
  comCsrf.set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
  return { credentials: 'include', headers: comCsrf };
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly getAccessToken: () => string | null;
  private readonly setAccessToken: (accessToken: string) => void;
  private readonly clearSession: () => void;
  /**
   * Refresh em andamento (single-flight, #153): requisições concorrentes com 401
   * compartilham a mesma promise. Dois refreshes com o mesmo refresh token
   * disparam a detecção de reuso no servidor e revogam todas as sessões.
   */
  private refreshInFlight: Promise<boolean> | null = null;
  /**
   * Logout em curso/concluído: nenhum refresh novo pode começar. Um 401 atrasado de uma
   * requisição enviada antes do logout dispararia um refresh cujo `Set-Cookie` restauraria
   * um refresh rotacionado que o logout nunca revogou. Zerado no próximo login.
   */
  private sessaoEncerrada = false;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken;
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

    // Sem access token não há sessão a renovar (ex.: 401 de credenciais erradas no login).
    if (response.status === 401 && accessToken && !skipAuthRetry && path !== '/api/auth/refresh') {
      const refreshed = await this.renewSession(accessToken);
      if (refreshed) {
        return this.request<T>(path, { ...options, skipAuthRetry: true });
      }
    }

    if (!response.ok) {
      const message = response.status === 401 ? 'Não autorizado' : 'Erro ao processar requisição';
      throw new ApiError(response.status, message, lerRetryAfterMs(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  /** Chamado no início do logout, antes de qualquer `await`: bloqueia refreshes novos. */
  encerrarSessao(): void {
    this.sessaoEncerrada = true;
  }

  /** Chamado após um login bem-sucedido: refreshes voltam a ser permitidos. */
  retomarSessao(): void {
    this.sessaoEncerrada = false;
  }

  /**
   * Resolve quando não há refresh em andamento (ou quando o atual termina, mesmo falhando).
   * O logout espera por aqui para revogar o cookie já rotacionado, não o antigo.
   */
  async aguardarRefresh(): Promise<void> {
    await this.refreshInFlight?.catch(() => undefined);
  }

  /**
   * Se o access token já mudou desde que a requisição foi enviada, outra
   * requisição concluiu o refresh enquanto esta esperava: basta re-tentar.
   */
  private renewSession(tokenUsed: string | null): Promise<boolean> {
    // O token atual (não o capturado no envio) diz se ainda há sessão: sem ela, não há o que renovar.
    const current = this.getAccessToken();
    if (this.sessaoEncerrada || !current) return Promise.resolve(false);
    if (this.refreshInFlight) return this.refreshInFlight;
    if (current && current !== tokenUsed) return Promise.resolve(true);

    this.refreshInFlight = this.refreshAccessToken().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async refreshAccessToken(): Promise<boolean> {
    // O refresh token vai (e volta) no cookie HttpOnly: o JS nunca o vê.
    const response = await this.fetchFn(`${this.baseUrl}/api/auth/refresh`, {
      ...cookieAuthInit({ 'Content-Type': 'application/json' }),
      method: 'POST',
      body: '{}',
    });

    if (!response.ok) {
      // Só 401/403 significam sessão perdida; 5xx é oscilação do servidor e o cookie segue válido.
      if (response.status === 401 || response.status === 403) this.clearSession();
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
