import type { CategoriaListResponse, TransacaoListResponse } from '@nossagrana/types';

import { somarDias } from './date';

type Categoria = CategoriaListResponse['categorias'][number];
type Transacao = TransacaoListResponse['transacoes'][number];

const JANELA_EM_DIAS = 60;
const LIMITE_PADRAO = 6;

interface EntradaMaisUsadas {
  transacoes: Transacao[];
  categorias: Categoria[];
  tipo: 'receita' | 'despesa';
  /** Hoje em AAAA-MM-DD (`getTodayLocalISO`). */
  hoje: string;
  limite?: number;
}

const contarPorCategoria = (transacoes: Transacao[], hoje: string): Map<string, number> => {
  const inicio = somarDias(hoje, -(JANELA_EM_DIAS - 1));
  const contagem = new Map<string, number>();
  for (const t of transacoes) {
    // Datas AAAA-MM-DD comparam como texto; futuro fica de fora para não pesar o que ainda não houve.
    if (t.data < inicio || t.data > hoje) continue;
    contagem.set(t.categoriaId, (contagem.get(t.categoriaId) ?? 0) + 1);
  }
  return contagem;
};

/**
 * As categorias do tipo que mais aparecem nos lançamentos dos últimos 60 dias (hoje incluído), da
 * mais usada para a menos usada, desempatando pelo nome. Se houver menos que `limite` (padrão 6),
 * completa com as primeiras do tipo na ordem da lista. Só entram categorias ativas do tipo.
 *
 * Ex.: `categoriasMaisUsadas({ transacoes, categorias, tipo: 'despesa', hoje: '2026-11-17' })`.
 */
export const categoriasMaisUsadas = ({
  transacoes,
  categorias,
  tipo,
  hoje,
  limite = LIMITE_PADRAO,
}: EntradaMaisUsadas): Categoria[] => {
  const doTipo = categorias.filter((c) => c.ativo && c.tipo === tipo);
  const contagem = contarPorCategoria(transacoes, hoje);
  const usadas = doTipo
    .filter((c) => contagem.has(c.id))
    .sort(
      (a, b) =>
        (contagem.get(b.id) ?? 0) - (contagem.get(a.id) ?? 0) ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    );
  const demais = doTipo.filter((c) => !contagem.has(c.id));
  return [...usadas, ...demais].slice(0, limite);
};
