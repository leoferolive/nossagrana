import type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
  FamiliaBuscarResponse,
  FamiliaCreateInviteResponse,
  FamiliaCreateRequest,
  FamiliaCreateResponse,
  FamiliaJoinByInviteResponse,
  FamiliaListJoinRequestsResponse,
  FamiliaListMembersResponse,
  FamiliaMinhasResponse,
  FamiliaRequestJoinResponse,
  FamiliaReviewJoinRequestResponse,
  FamiliaSwitchActiveResponse,
} from '@nossagrana/types';

import { ApiClient, cookieAuthInit } from './api-client';
import { lazyApiClient } from './core-financeiro.service';
import { comLockDeRefresh, type LockManagerLike } from './refresh-lock';

/** Um POST pendurado seguraria o lock entre abas e travaria bootstrap e próximo login. */
const POST_COM_LOCK_TIMEOUT_MS = 10_000;

const familiaHeader = (familiaId: string): Record<string, string> => ({
  'X-Familia-Id': familiaId,
});

// ─── AuthService ───────────────────────────────────────────────────────────────

export class AuthService {
  /**
   * Logout em andamento (espera um refresh em voo antes do POST). Um login feito nesse
   * intervalo precisa esperar: senão o POST de logout sairia com o cookie NOVO e revogaria a
   * sessão recém-criada.
   */
  private logoutEmAndamento: Promise<void> | null = null;

  /**
   * `locks` (padrão `navigator.locks`): login e logout rotacionam/revogam o cookie de refresh e
   * por isso entram no mesmo lock do refresh, senão outra aba refrescaria com um token que
   * acabou de ser revogado (TOKEN_REUSE_DETECTED) ou receberia um Set-Cookie após o clear.
   */
  constructor(
    private readonly api: ApiClient,
    private readonly locks?: LockManagerLike,
  ) {}

  async login(payload: AuthLoginRequest): Promise<AuthLoginResponse> {
    // Falha do logout pendente não pode impedir o login.
    await this.logoutEmAndamento?.catch(() => undefined);
    const resposta = await comLockDeRefresh(
      () =>
        this.api.request<AuthLoginResponse>('/api/auth/login', {
          ...cookieAuthInit({ 'Content-Type': 'application/json' }),
          method: 'POST',
          body: JSON.stringify(payload),
          skipAuthRetry: true,
          timeoutMs: POST_COM_LOCK_TIMEOUT_MS,
        }),
      this.locks,
    );
    this.api.retomarSessao();
    return resposta;
  }

  async register(payload: AuthRegisterRequest): Promise<AuthRegisterResponse> {
    return this.api.request<AuthRegisterResponse>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /** O servidor revoga o refresh vigente (cookie) e limpa o cookie; não há token para enviar. */
  async logout(): Promise<void> {
    // Sem refresh novo a partir daqui (nem por 401 atrasado de requisições já enviadas).
    this.api.encerrarSessao();
    const logout = this.enviarLogout().finally(() => {
      if (this.logoutEmAndamento === logout) this.logoutEmAndamento = null;
    });
    this.logoutEmAndamento = logout;
    return logout;
  }

  private async enviarLogout(): Promise<void> {
    // Um refresh em voo rotaciona o cookie: revogar antes dele deixaria o novo cookie vivo.
    await this.api.aguardarRefresh();
    return comLockDeRefresh(
      () =>
        this.api.request<void>('/api/auth/logout', {
          ...cookieAuthInit(),
          method: 'POST',
          skipAuthRetry: true,
          timeoutMs: POST_COM_LOCK_TIMEOUT_MS,
        }),
      this.locks,
    );
  }
}

// ─── FamiliaService ────────────────────────────────────────────────────────────

export class FamiliaService {
  constructor(private readonly api: ApiClient) {}

  async listarMinhas(): Promise<FamiliaMinhasResponse> {
    return this.api.request<FamiliaMinhasResponse>('/api/familias/minhas');
  }

  async criar(payload: FamiliaCreateRequest): Promise<FamiliaCreateResponse> {
    return this.api.request<FamiliaCreateResponse>('/api/familias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async entrarPorConvite(codigo: string): Promise<FamiliaJoinByInviteResponse> {
    return this.api.request<FamiliaJoinByInviteResponse>(`/api/familias/entrar/${codigo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  async solicitarEntrada(familiaId: string): Promise<FamiliaRequestJoinResponse> {
    return this.api.request<FamiliaRequestJoinResponse>('/api/familias/solicitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familiaId }),
    });
  }

  async alternar(familiaId: string): Promise<FamiliaSwitchActiveResponse> {
    return this.api.request<FamiliaSwitchActiveResponse>('/api/familias/alternar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familiaId }),
    });
  }

  async listarMembros(familiaId: string): Promise<FamiliaListMembersResponse> {
    return this.api.request<FamiliaListMembersResponse>(`/api/familias/${familiaId}/membros`, {
      headers: familiaHeader(familiaId),
    });
  }

  async gerarConvite(familiaId: string): Promise<FamiliaCreateInviteResponse> {
    return this.api.request<FamiliaCreateInviteResponse>('/api/familias/convites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify({}),
    });
  }

  async revisarSolicitacao(
    id: string,
    acao: 'aprovar' | 'rejeitar',
    familiaId: string,
  ): Promise<FamiliaReviewJoinRequestResponse> {
    return this.api.request<FamiliaReviewJoinRequestResponse>(`/api/familias/solicitacoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify({ acao }),
    });
  }

  async removerMembro(familiaId: string, usuarioId: string): Promise<void> {
    return this.api.request<void>(`/api/familias/${familiaId}/membros/${usuarioId}`, {
      method: 'DELETE',
      headers: familiaHeader(familiaId),
    });
  }

  async listarSolicitacoes(familiaId: string): Promise<FamiliaListJoinRequestsResponse> {
    return this.api.request<FamiliaListJoinRequestsResponse>('/api/familias/solicitacoes', {
      headers: familiaHeader(familiaId),
    });
  }

  async buscar(nome: string): Promise<FamiliaBuscarResponse> {
    return this.api.request<FamiliaBuscarResponse>(
      `/api/familias/buscar?nome=${encodeURIComponent(nome)}`,
    );
  }
}

// ─── Singletons ────────────────────────────────────────────────────────────────

export const authService = new AuthService(lazyApiClient);
export const familiaService = new FamiliaService(lazyApiClient);
