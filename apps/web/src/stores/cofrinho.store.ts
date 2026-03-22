import { create } from 'zustand';

import type { CofrinhoDetalheResponse, CofrinhoListResponse } from '@nossagrana/types';

import { cofrinhoService } from '../services/cofrinho.service';

interface CofrinhoStore {
  cofrinhos: CofrinhoListResponse['cofrinhos'];
  cofrinhoSelecionado: CofrinhoDetalheResponse | null;
  carregando: boolean;
  erro: string | null;
  fetchAll: (familiaId: string) => Promise<void>;
  fetchDetalhe: (familiaId: string, cofrinhoId: string) => Promise<void>;
  reset: () => void;
}

export const useCofrinhoStore = create<CofrinhoStore>((set) => ({
  cofrinhos: [],
  cofrinhoSelecionado: null,
  carregando: false,
  erro: null,

  async fetchAll(familiaId) {
    set({ carregando: true, erro: null });
    try {
      const data = await cofrinhoService.listar(familiaId);
      set({ cofrinhos: data.cofrinhos, carregando: false });
    } catch {
      set({ erro: 'Erro ao carregar cofrinhos', carregando: false });
    }
  },

  async fetchDetalhe(familiaId, cofrinhoId) {
    set({ carregando: true, erro: null });
    try {
      const data = await cofrinhoService.detalhe(familiaId, cofrinhoId);
      set({ cofrinhoSelecionado: data, carregando: false });
    } catch {
      set({ erro: 'Erro ao carregar detalhe do cofrinho', carregando: false });
    }
  },

  reset: () => set({ cofrinhos: [], cofrinhoSelecionado: null, erro: null }),
}));
