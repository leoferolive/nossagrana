import type {
  CategoriaCreateRequest,
  CategoriaCreateResponse,
  CategoriaDeleteResponse,
  CategoriaListResponse,
  CategoriaUpdateRequest,
  CategoriaUpdateResponse,
  DashboardGraficosResponse,
  DashboardOrcamentoResponse,
  DashboardResumoResponse,
  FaturaResponse,
  MetodoPagamentoCreateRequest,
  MetodoPagamentoCreateResponse,
  MetodoPagamentoDeleteResponse,
  MetodoPagamentoListResponse,
  MetodoPagamentoUpdateRequest,
  MetodoPagamentoUpdateResponse,
  OrcamentoHistoricoResponse,
  OrcamentoListResponse,
  OrcamentoSetRequest,
  OrcamentoSetResponse,
  RelatorioDistribuicaoResponse,
  RelatorioPorUsuarioResponse,
  RelatorioTendenciasResponse,
  TransacaoCreateRequest,
  TransacaoCreateResponse,
  TransacaoListQuery,
  TransacaoListResponse,
  TransacaoResponse,
  TransacaoUpdateRequest,
} from '@nossagrana/types';

import { ApiClient } from './api-client';

const familiaHeader = (familiaId: string) => ({ 'X-Familia-Id': familiaId });

// ─── Categorias ──────────────────────────────────────────────────────────────

export class CategoriaService {
  constructor(private readonly api: ApiClient) {}

  async listar(familiaId: string): Promise<CategoriaListResponse> {
    return this.api.request<CategoriaListResponse>('/api/categorias', {
      headers: familiaHeader(familiaId),
    });
  }

  async criar(
    payload: CategoriaCreateRequest,
    familiaId: string,
  ): Promise<CategoriaCreateResponse> {
    return this.api.request<CategoriaCreateResponse>('/api/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async editar(
    id: string,
    payload: CategoriaUpdateRequest,
    familiaId: string,
  ): Promise<CategoriaUpdateResponse> {
    return this.api.request<CategoriaUpdateResponse>(`/api/categorias/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async desativar(id: string, familiaId: string): Promise<CategoriaDeleteResponse> {
    return this.api.request<CategoriaDeleteResponse>(`/api/categorias/${id}`, {
      method: 'DELETE',
      headers: familiaHeader(familiaId),
    });
  }
}

// ─── Métodos de Pagamento ─────────────────────────────────────────────────────

export class MetodoPagamentoService {
  constructor(private readonly api: ApiClient) {}

  async listar(familiaId: string): Promise<MetodoPagamentoListResponse> {
    return this.api.request<MetodoPagamentoListResponse>('/api/metodos-pagamento', {
      headers: familiaHeader(familiaId),
    });
  }

  async criar(
    payload: MetodoPagamentoCreateRequest,
    familiaId: string,
  ): Promise<MetodoPagamentoCreateResponse> {
    return this.api.request<MetodoPagamentoCreateResponse>('/api/metodos-pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async editar(
    id: string,
    payload: MetodoPagamentoUpdateRequest,
    familiaId: string,
  ): Promise<MetodoPagamentoUpdateResponse> {
    return this.api.request<MetodoPagamentoUpdateResponse>(`/api/metodos-pagamento/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async desativar(id: string, familiaId: string): Promise<MetodoPagamentoDeleteResponse> {
    return this.api.request<MetodoPagamentoDeleteResponse>(`/api/metodos-pagamento/${id}`, {
      method: 'DELETE',
      headers: familiaHeader(familiaId),
    });
  }
}

// ─── Transações ───────────────────────────────────────────────────────────────

export class TransacaoService {
  constructor(private readonly api: ApiClient) {}

  async listar(filtros: TransacaoListQuery, familiaId: string): Promise<TransacaoListResponse> {
    const params = new URLSearchParams();
    if (filtros.mesReferencia) params.set('mesReferencia', filtros.mesReferencia);
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    if (filtros.categoriaId) params.set('categoriaId', filtros.categoriaId);
    if (filtros.usuarioRegistrouId) params.set('usuarioRegistrouId', filtros.usuarioRegistrouId);
    if (filtros.metodoPagamentoId) params.set('metodoPagamentoId', filtros.metodoPagamentoId);

    const qs = params.toString();
    return this.api.request<TransacaoListResponse>(`/api/transacoes${qs ? `?${qs}` : ''}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async detalhe(id: string, familiaId: string): Promise<TransacaoResponse> {
    return this.api.request<TransacaoResponse>(`/api/transacoes/${id}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async registrar(
    payload: TransacaoCreateRequest,
    familiaId: string,
  ): Promise<TransacaoCreateResponse> {
    return this.api.request<TransacaoCreateResponse>('/api/transacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async editar(
    id: string,
    payload: TransacaoUpdateRequest,
    familiaId: string,
  ): Promise<TransacaoResponse> {
    return this.api.request<TransacaoResponse>(`/api/transacoes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async excluir(id: string, familiaId: string): Promise<void> {
    return this.api.request<void>(`/api/transacoes/${id}`, {
      method: 'DELETE',
      headers: familiaHeader(familiaId),
    });
  }
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export class DashboardService {
  constructor(private readonly api: ApiClient) {}

  async getDashboardResumo(
    familiaId: string,
    mesReferencia?: string,
  ): Promise<DashboardResumoResponse> {
    const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
    return this.api.request<DashboardResumoResponse>(`/api/dashboard${qs}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async getDashboardGraficos(
    familiaId: string,
    mesReferencia?: string,
  ): Promise<DashboardGraficosResponse> {
    const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
    return this.api.request<DashboardGraficosResponse>(`/api/dashboard/graficos${qs}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async getDashboardOrcamento(
    familiaId: string,
    mesReferencia?: string,
  ): Promise<DashboardOrcamentoResponse> {
    const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
    return this.api.request<DashboardOrcamentoResponse>(`/api/dashboard/orcamento${qs}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async getOrcamentos(familiaId: string, mesReferencia?: string): Promise<OrcamentoListResponse> {
    const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
    return this.api.request<OrcamentoListResponse>(`/api/orcamento${qs}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async setOrcamento(
    familiaId: string,
    categoriaId: string,
    payload: OrcamentoSetRequest,
  ): Promise<OrcamentoSetResponse> {
    return this.api.request<OrcamentoSetResponse>(`/api/orcamento/${categoriaId}`, {
      method: 'POST',
      headers: { ...familiaHeader(familiaId), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  async getOrcamentoHistorico(
    familiaId: string,
    categoriaId: string,
  ): Promise<OrcamentoHistoricoResponse> {
    return this.api.request<OrcamentoHistoricoResponse>(`/api/orcamento/${categoriaId}/historico`, {
      headers: familiaHeader(familiaId),
    });
  }

  async getRelatorioDistribuicao(
    familiaId: string,
    mesReferencia?: string,
  ): Promise<RelatorioDistribuicaoResponse> {
    const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
    return this.api.request<RelatorioDistribuicaoResponse>(`/api/relatorios/distribuicao${qs}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async getRelatorioPorUsuario(
    familiaId: string,
    mesReferencia?: string,
  ): Promise<RelatorioPorUsuarioResponse> {
    const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
    return this.api.request<RelatorioPorUsuarioResponse>(`/api/relatorios/por-usuario${qs}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async getRelatorioTendencias(
    familiaId: string,
    meses?: number,
  ): Promise<RelatorioTendenciasResponse> {
    const qs = meses ? `?meses=${meses}` : '';
    return this.api.request<RelatorioTendenciasResponse>(`/api/relatorios/tendencias${qs}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async getFatura(
    familiaId: string,
    metodoPagamentoId: string,
    mesReferencia: string,
  ): Promise<FaturaResponse> {
    return this.api.request<FaturaResponse>(
      `/api/cartoes/${metodoPagamentoId}/fatura/${mesReferencia}`,
      { headers: familiaHeader(familiaId) },
    );
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

const AUTH_STORAGE_KEY = 'nossagrana.auth.session';

const readStoredSession = (): { accessToken?: string; refreshToken?: string } => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { accessToken?: string; refreshToken?: string }) : {};
  } catch {
    return {};
  }
};

const lazyApiClient = new ApiClient({
  baseUrl: typeof import.meta !== 'undefined' ? (import.meta.env.VITE_API_URL ?? '') : '',
  getAccessToken: () => readStoredSession().accessToken ?? null,
  getRefreshToken: () => readStoredSession().refreshToken ?? null,
  setAccessToken: (token: string) => {
    const session = readStoredSession();
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ ...session, accessToken: token }));
  },
  clearSession: () => localStorage.removeItem(AUTH_STORAGE_KEY),
});

export const coreFinanceiroService = new DashboardService(lazyApiClient);
