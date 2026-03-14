import { create } from 'zustand';

import type { MetodoPagamentoListResponse } from '@nossagrana/types';

type MetodoPagamento = MetodoPagamentoListResponse['metodosPagamento'][number];

interface MetodoPagamentoState {
  metodos: MetodoPagamento[];
  carregando: boolean;
  erro: string | null;
  setMetodos: (metodos: MetodoPagamento[]) => void;
  addMetodo: (metodo: MetodoPagamento) => void;
  updateMetodo: (metodo: MetodoPagamento) => void;
  removeMetodo: (id: string) => void;
  setCarregando: (v: boolean) => void;
  setErro: (erro: string | null) => void;
}

export const useMetodoPagamentoStore = create<MetodoPagamentoState>((set) => ({
  metodos: [],
  carregando: false,
  erro: null,
  setMetodos: (metodos) => set({ metodos }),
  addMetodo: (metodo) =>
    set((state) => ({ metodos: [...state.metodos, metodo] })),
  updateMetodo: (metodo) =>
    set((state) => ({
      metodos: state.metodos.map((m) => (m.id === metodo.id ? metodo : m)),
    })),
  removeMetodo: (id) =>
    set((state) => ({ metodos: state.metodos.filter((m) => m.id !== id) })),
  setCarregando: (carregando) => set({ carregando }),
  setErro: (erro) => set({ erro }),
}));
