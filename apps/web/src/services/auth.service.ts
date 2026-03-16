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
  FamiliaRequestJoinResponse,
  FamiliaReviewJoinRequestResponse,
  FamiliaSwitchActiveResponse,
} from '@nossagrana/types';

import { ApiClient } from './api-client';
import { lazyApiClient } from './core-financeiro.service';

const familiaHeader = (familiaId: string): Record<string, string> => ({
  'X-Familia-Id': familiaId,
});

// ─── AuthService ───────────────────────────────────────────────────────────────

export class AuthService {
  constructor(private readonly api: ApiClient) {}

  async login(payload: AuthLoginRequest): Promise<AuthLoginResponse> {
    return this.api.request<AuthLoginResponse>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async register(payload: AuthRegisterRequest): Promise<AuthRegisterResponse> {
    return this.api.request<AuthRegisterResponse>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async logout(refreshToken: string): Promise<void> {
    return this.api.request<void>('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  }
}

// ─── FamiliaService ────────────────────────────────────────────────────────────

export class FamiliaService {
  constructor(private readonly api: ApiClient) {}

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
