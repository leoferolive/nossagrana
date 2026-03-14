import { create } from 'zustand';

import type { TransacaoListQuery, TransacaoListResponse } from '@nossagrana/types';

type Transacao = TransacaoListResponse['transacoes'][number];

interface TransacaoState {
  transacoes: Transacao[];
  carregando: boolean;
  erro: string | null;
  filtros: TransacaoListQuery;
  setTransacoes: (transacoes: Transacao[]) => void;
  addTransacao: (transacao: Transacao) => void;
  updateTransacao: (transacao: Transacao) => void;
  removeTransacao: (id: string) => void;
  setFiltros: (filtros: Partial<TransacaoListQuery>) => void;
  setCarregando: (v: boolean) => void;
  setErro: (erro: string | null) => void;
}

export const useTransacaoStore = create<TransacaoState>((set) => ({
  transacoes: [],
  carregando: false,
  erro: null,
  filtros: {},
  setTransacoes: (transacoes) => set({ transacoes }),
  addTransacao: (transacao) =>
    set((state) => ({ transacoes: [transacao, ...state.transacoes] })),
  updateTransacao: (transacao) =>
    set((state) => ({
      transacoes: state.transacoes.map((t) => (t.id === transacao.id ? transacao : t)),
    })),
  removeTransacao: (id) =>
    set((state) => ({ transacoes: state.transacoes.filter((t) => t.id !== id) })),
  setFiltros: (filtros) =>
    set((state) => ({ filtros: { ...state.filtros, ...filtros } })),
  setCarregando: (carregando) => set({ carregando }),
  setErro: (erro) => set({ erro }),
}));
