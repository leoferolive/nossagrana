import { create } from 'zustand';

import type { CategoriaListResponse } from '@nossagrana/types';

type Categoria = CategoriaListResponse['categorias'][number];
type CategoriaTipo = Categoria['tipo'];

interface CategoriaAtual {
  id: string | null;
  nome?: string | null;
}

/**
 * Opções de categoria para o tipo do lançamento — a API rejeita (422
 * REFERENCIA_INVALIDA) transação/template com categoria de outro tipo.
 * A store só tem categorias ativas: a `atual` de um registro em edição que
 * não está na lista (desativada) entra como "(inativa)" para não sumir.
 * Ex.: `categoriasParaSelecao(categorias, 'receita', { id, nome })`.
 */
export const categoriasParaSelecao = (
  categorias: Categoria[],
  tipo: CategoriaTipo,
  atual?: CategoriaAtual,
): { id: string; nome: string }[] => {
  const doTipo = categorias.filter((c) => c.tipo === tipo);
  if (!atual?.id || categorias.some((c) => c.id === atual.id)) return doTipo;
  const nome = atual.nome ? `${atual.nome} (inativa)` : 'Categoria inativa';
  return [...doTipo, { id: atual.id, nome }];
};

/**
 * Devolve '' só com incoerência comprovada: a categoria está na lista e é de
 * outro tipo. Id fora da lista (inativa ou ainda não carregada) é mantido —
 * a API aceita manter a mesma categoria inativa na edição (PR #127).
 */
export const categoriaIdCompativel = (
  categorias: Categoria[],
  tipo: CategoriaTipo,
  categoriaId: string,
): string => {
  const categoria = categorias.find((c) => c.id === categoriaId);
  return categoria && categoria.tipo !== tipo ? '' : categoriaId;
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
