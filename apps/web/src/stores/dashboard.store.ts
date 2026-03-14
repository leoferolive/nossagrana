import { create } from 'zustand';

import type {
  DashboardGraficosResponse,
  DashboardOrcamentoResponse,
  DashboardResumoResponse,
} from '@nossagrana/types';

import { coreFinanceiroService } from '../services/core-financeiro.service';

interface DashboardStore {
  resumo: DashboardResumoResponse | null;
  graficos: DashboardGraficosResponse | null;
  orcamento: DashboardOrcamentoResponse;
  loading: boolean;
  error: string | null;
  fetchAll(familiaId: string, mesReferencia?: string): Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  resumo: null,
  graficos: null,
  orcamento: [],
  loading: false,
  error: null,

  async fetchAll(familiaId, mesReferencia) {
    set({ loading: true, error: null });
    try {
      const [resumo, graficos, orcamento] = await Promise.all([
        coreFinanceiroService.getDashboardResumo(familiaId, mesReferencia),
        coreFinanceiroService.getDashboardGraficos(familiaId, mesReferencia),
        coreFinanceiroService.getDashboardOrcamento(familiaId, mesReferencia),
      ]);
      set({ resumo, graficos, orcamento, loading: false });
    } catch {
      set({ error: 'Erro ao carregar dashboard', loading: false });
    }
  },
}));
