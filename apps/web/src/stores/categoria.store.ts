import { create } from 'zustand';

import type { CategoriaListResponse } from '@nossagrana/types';

type Categoria = CategoriaListResponse['categorias'][number];
type CategoriaTipo = Categoria['tipo'];

/**
 * Categorias compatíveis com o tipo do lançamento — a API rejeita (422
 * REFERENCIA_INVALIDA) transação/template com categoria de outro tipo.
 * Ex.: `categoriasDoTipo(categorias, 'receita')`.
 */
export const categoriasDoTipo = (categorias: Categoria[], tipo: CategoriaTipo): Categoria[] =>
  categorias.filter((c) => c.tipo === tipo);

/**
 * Mantém `categoriaId` só se for do `tipo`; senão devolve '' (sem seleção).
 * Com a lista ainda não carregada não há como validar, então o id é preservado.
 */
export const categoriaIdCompativel = (
  categorias: Categoria[],
  tipo: CategoriaTipo,
  categoriaId: string,
): string => {
  if (!categoriaId || categorias.length === 0) return categoriaId;
  return categorias.some((c) => c.id === categoriaId && c.tipo === tipo) ? categoriaId : '';
};

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
  addCategoria: (categoria) => set((state) => ({ categorias: [...state.categorias, categoria] })),
  updateCategoria: (categoria) =>
    set((state) => ({
      categorias: state.categorias.map((c) => (c.id === categoria.id ? categoria : c)),
    })),
  removeCategoria: (id) =>
    set((state) => ({ categorias: state.categorias.filter((c) => c.id !== id) })),
  setCarregando: (carregando) => set({ carregando }),
  setErro: (erro) => set({ erro }),
}));
