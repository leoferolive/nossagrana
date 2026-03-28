import type {
  TemplateTransacaoAplicarRequest,
  TemplateTransacaoAplicarResponse,
  TemplateTransacaoCreateRequest,
  TemplateTransacaoCreateResponse,
  TemplateTransacaoListResponse,
  TemplateTransacaoReordenarRequest,
  TemplateTransacaoUpdateRequest,
} from '@nossagrana/types';

import type { ApiClient } from './api-client';
import { lazyApiClient } from './core-financeiro.service';

class TemplateTransacaoService {
  constructor(private readonly api: ApiClient) {}

  async listar(
    familiaId: string,
    tipo?: 'receita' | 'despesa',
  ): Promise<TemplateTransacaoListResponse> {
    const query = tipo ? `?tipo=${tipo}` : '';
    return this.api.request<TemplateTransacaoListResponse>(`/api/templates-transacao${query}`, {
      headers: { 'X-Familia-Id': familiaId },
    });
  }

  async criar(
    familiaId: string,
    payload: TemplateTransacaoCreateRequest,
  ): Promise<TemplateTransacaoCreateResponse> {
    return this.api.request<TemplateTransacaoCreateResponse>('/api/templates-transacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Familia-Id': familiaId },
      body: JSON.stringify(payload),
    });
  }

  async editar(
    familiaId: string,
    id: string,
    payload: TemplateTransacaoUpdateRequest,
  ): Promise<TemplateTransacaoCreateResponse> {
    return this.api.request<TemplateTransacaoCreateResponse>(`/api/templates-transacao/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Familia-Id': familiaId },
      body: JSON.stringify(payload),
    });
  }

  async excluir(familiaId: string, id: string): Promise<void> {
    await this.api.request(`/api/templates-transacao/${id}`, {
      method: 'DELETE',
      headers: { 'X-Familia-Id': familiaId },
    });
  }

  async aplicar(
    familiaId: string,
    payload: TemplateTransacaoAplicarRequest,
  ): Promise<TemplateTransacaoAplicarResponse> {
    return this.api.request<TemplateTransacaoAplicarResponse>('/api/templates-transacao/aplicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Familia-Id': familiaId },
      body: JSON.stringify(payload),
    });
  }

  async reordenar(familiaId: string, payload: TemplateTransacaoReordenarRequest): Promise<void> {
    await this.api.request('/api/templates-transacao/reordenar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Familia-Id': familiaId },
      body: JSON.stringify(payload),
    });
  }
}

export const templateTransacaoService = new TemplateTransacaoService(lazyApiClient);
