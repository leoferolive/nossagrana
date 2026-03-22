import type {
  CofrinhoAporteRequest,
  CofrinhoAporteResponse,
  CofrinhoCreateRequest,
  CofrinhoCreateResponse,
  CofrinhoDetalheResponse,
  CofrinhoEncerrarRequest,
  CofrinhoEncerrarResponse,
  CofrinhoListResponse,
  CofrinhoRetiradaRequest,
  CofrinhoRetiradaResponse,
  CofrinhoUpdateRequest,
  DashboardCofrinhoResponse,
} from '@nossagrana/types';

import { ApiClient } from './api-client';
import { lazyApiClient } from './core-financeiro.service';

const familiaHeader = (familiaId: string) => ({ 'X-Familia-Id': familiaId });

// ─── Cofrinhos ───────────────────────────────────────────────────────────────

export class CofrinhoService {
  constructor(private readonly api: ApiClient) {}

  async listar(familiaId: string, status = 'ativo'): Promise<CofrinhoListResponse> {
    return this.api.request<CofrinhoListResponse>(`/api/cofrinhos?status=${status}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async detalhe(familiaId: string, id: string): Promise<CofrinhoDetalheResponse> {
    return this.api.request<CofrinhoDetalheResponse>(`/api/cofrinhos/${id}`, {
      headers: familiaHeader(familiaId),
    });
  }

  async criar(
    familiaId: string,
    payload: CofrinhoCreateRequest,
  ): Promise<CofrinhoCreateResponse> {
    return this.api.request<CofrinhoCreateResponse>('/api/cofrinhos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async editar(
    familiaId: string,
    id: string,
    payload: CofrinhoUpdateRequest,
  ): Promise<CofrinhoCreateResponse> {
    return this.api.request<CofrinhoCreateResponse>(`/api/cofrinhos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async aportar(
    familiaId: string,
    id: string,
    payload: CofrinhoAporteRequest,
  ): Promise<CofrinhoAporteResponse> {
    return this.api.request<CofrinhoAporteResponse>(`/api/cofrinhos/${id}/aportar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async retirar(
    familiaId: string,
    id: string,
    payload: CofrinhoRetiradaRequest,
  ): Promise<CofrinhoRetiradaResponse> {
    return this.api.request<CofrinhoRetiradaResponse>(`/api/cofrinhos/${id}/retirar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async encerrar(
    familiaId: string,
    id: string,
    payload: CofrinhoEncerrarRequest,
  ): Promise<CofrinhoEncerrarResponse> {
    return this.api.request<CofrinhoEncerrarResponse>(`/api/cofrinhos/${id}/encerrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...familiaHeader(familiaId) },
      body: JSON.stringify(payload),
    });
  }

  async cancelarAporteRecorrente(familiaId: string, id: string): Promise<void> {
    return this.api.request<void>(`/api/cofrinhos/${id}/aporte-recorrente`, {
      method: 'DELETE',
      headers: familiaHeader(familiaId),
    });
  }

  async resumoDashboard(familiaId: string): Promise<DashboardCofrinhoResponse> {
    const { cofrinhos } = await this.listar(familiaId, 'ativo');
    return {
      cofrinhos: cofrinhos.map((c) => ({
        id: c.id,
        nome: c.nome,
        emoji: c.emoji,
        saldoAtual: c.saldoAtual,
        metaValor: c.metaValor,
        percentualMeta: c.metaValor
          ? Math.round((parseFloat(c.saldoAtual) / parseFloat(c.metaValor)) * 100)
          : null,
      })),
    };
  }
}

export const cofrinhoService = new CofrinhoService(lazyApiClient);
