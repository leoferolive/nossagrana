import type {
  CategoriaCreateRequest,
  CategoriaCreateResponse,
  CategoriaDeleteResponse,
  CategoriaListResponse,
  CategoriaUpdateRequest,
  CategoriaUpdateResponse,
  MetodoPagamentoCreateRequest,
  MetodoPagamentoCreateResponse,
  MetodoPagamentoDeleteResponse,
  MetodoPagamentoListResponse,
  MetodoPagamentoUpdateRequest,
  MetodoPagamentoUpdateResponse,
  TransacaoCreateRequest,
  TransacaoCreateResponse,
  TransacaoListQuery,
  TransacaoListResponse,
  TransacaoResponse,
  TransacaoUpdateRequest,
} from '@nossagrana/types';

import type { ApiClient } from './api-client';

const familiaHeader = (familiaId: string) => ({ 'X-Familia-Id': familiaId });

// ─── Categorias ──────────────────────────────────────────────────────────────

export class CategoriaService {
  constructor(private readonly api: ApiClient) {}

  async listar(familiaId: string): Promise<CategoriaListResponse> {
    return this.api.request<CategoriaListResponse>('/api/categorias', {
      headers: familiaHeader(familiaId),
    });
  }

  async criar(payload: CategoriaCreateRequest, familiaId: string): Promise<CategoriaCreateResponse> {
    return this.api.request<CategoriaCreateResponse>('/api/categorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async editar(id: string, payload: CategoriaUpdateRequest, familiaId: string): Promise<CategoriaUpdateResponse> {
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

  async criar(payload: MetodoPagamentoCreateRequest, familiaId: string): Promise<MetodoPagamentoCreateResponse> {
    return this.api.request<MetodoPagamentoCreateResponse>('/api/metodos-pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async editar(id: string, payload: MetodoPagamentoUpdateRequest, familiaId: string): Promise<MetodoPagamentoUpdateResponse> {
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

  async registrar(payload: TransacaoCreateRequest, familiaId: string): Promise<TransacaoCreateResponse> {
    return this.api.request<TransacaoCreateResponse>('/api/transacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async editar(id: string, payload: TransacaoUpdateRequest, familiaId: string): Promise<TransacaoResponse> {
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
