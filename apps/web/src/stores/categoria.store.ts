import { create } from 'zustand';

import type { CategoriaListResponse } from '@nossagrana/types';

type Categoria = CategoriaListResponse['categorias'][number];

interface CategoriaState {
  categorias: Categoria[];
  carregando: boolean;
  erro: string | null;
  setCategorias: (categorias: Categoria[]) => void;
  addCategoria: (categoria: Categoria) => void;
  updateCategoria: (categoria: Categoria) => void;
  removeCategoria: (id: string) => void;
  setCarregando: (v: boolean) => void;
  setErro: (erro: string | null) => void;
}

export const useCategoriaStore = create<CategoriaState>((set) => ({
  categorias: [],
  carregando: false,
  erro: null,
  setCategorias: (categorias) => set({ categorias }),
  addCategoria: (categoria) =>
    set((state) => ({ categorias: [...state.categorias, categoria] })),
  updateCategoria: (categoria) =>
    set((state) => ({
      categorias: state.categorias.map((c) => (c.id === categoria.id ? categoria : c)),
    })),
  removeCategoria: (id) =>
    set((state) => ({ categorias: state.categorias.filter((c) => c.id !== id) })),
  setCarregando: (carregando) => set({ carregando }),
  setErro: (erro) => set({ erro }),
}));
