import type { TransacaoCreateRequest, TransacaoUpdateRequest } from '@nossagrana/types';
import { useEffect } from 'react';

import type { DadosVoz, TransacaoParaEditar } from '@/components/lancar/tipos-lancar';
import { categoriaService, metodoPagamentoService } from '@/services/core-financeiro.service';
import {
  categoriaIdCompativel,
  categoriasParaSelecao,
  useCategoriaStore,
} from '@/stores/categoria.store';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';

import { useCategoriasMaisUsadas } from './use-categorias-mais-usadas';
import { montarCriacao, montarEdicao, useFormularioLancamento } from './use-formulario-lancamento';

interface EntradaDoPainel {
  familiaId: string;
  transacaoParaEditar?: TransacaoParaEditar | null;
  dadosVoz?: DadosVoz | null;
  onSubmit: (payload: TransacaoCreateRequest) => void | Promise<void>;
  onUpdate?: (id: string, payload: TransacaoUpdateRequest) => void | Promise<void>;
}

/** Carrega categorias e formas de pagamento da família se as stores ainda estão vazias. */
const useReferenciasDaFamilia = (familiaId: string) => {
  const categorias = useCategoriaStore((s) => s.categorias);
  const setCategorias = useCategoriaStore((s) => s.setCategorias);
  const metodos = useMetodoPagamentoStore((s) => s.metodos);
  const setMetodos = useMetodoPagamentoStore((s) => s.setMetodos);

  useEffect(() => {
    if (!familiaId) return;
    if (categorias.length === 0) {
      categoriaService
        .listar(familiaId)
        .then((res) => setCategorias(res.categorias))
        .catch(() => {});
    }
    if (metodos.length === 0) {
      metodoPagamentoService
        .listar(familiaId)
        .then((res) => setMetodos(res.metodosPagamento))
        .catch(() => {});
    }
  }, [familiaId, categorias.length, metodos.length, setCategorias, setMetodos]);

  return { categorias, metodos };
};

const motivoDoBloqueio = (
  tipo: 'receita' | 'despesa',
  valor: string,
  categoriaId: string,
): string | null => {
  const faltas: string[] = [];
  if (!(Number(valor) > 0)) faltas.push('digite o valor');
  if (!categoriaId) faltas.push(`escolha uma categoria de ${tipo}`);
  if (faltas.length === 0) return null;
  const frase = faltas.join(' e ');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
};

/** Tudo o que o painel de lançar mostra e decide: campos, categorias, bloqueio e a gravação. */
export const useDadosDoPainel = ({
  familiaId,
  transacaoParaEditar,
  dadosVoz,
  onSubmit,
  onUpdate,
}: EntradaDoPainel) => {
  const { categorias, metodos } = useReferenciasDaFamilia(familiaId);
  const formulario = useFormularioLancamento(transacaoParaEditar, dadosVoz);
  const { campos, mudar } = formulario;
  const maisUsadas = useCategoriasMaisUsadas(familiaId, campos.tipo);
  const editando = !!transacaoParaEditar;
  // Derivado para cobrir voz/edição preenchidas antes das categorias carregarem.
  const categoriaIdValido = categoriaIdCompativel(categorias, campos.tipo, campos.categoriaId);
  const ehCredito = metodos.some((m) => m.id === campos.metodoPagamentoId && m.tipo === 'credito');
  const tipoOriginal = transacaoParaEditar?.tipo;

  // Troca de tipo só preserva categoria ativa do novo tipo: uma inativa (fora
  // da lista) tem tipo desconhecido e a API rejeitaria a combinação.
  const trocarTipo = (novoTipo: 'receita' | 'despesa') => {
    if (novoTipo === campos.tipo) return;
    const serve = categorias.some((c) => c.id === campos.categoriaId && c.tipo === novoTipo);
    mudar({ tipo: novoTipo, categoriaId: serve ? campos.categoriaId : '' });
  };

  const gravar = async () => {
    const entrada = { campos, categoriaId: categoriaIdValido, ehCredito };
    if (editando && onUpdate) return onUpdate(transacaoParaEditar.id, montarEdicao(entrada));
    return onSubmit(montarCriacao(entrada));
  };

  return {
    ...formulario,
    editando,
    metodos: metodos.filter((m) => m.ativo),
    maisUsadas,
    categoriaIdValido,
    ehCredito,
    trocarTipo,
    gravar,
    motivo: motivoDoBloqueio(campos.tipo, campos.valor, categoriaIdValido),
    opcoesDeCategoria: categoriasParaSelecao(categorias, campos.tipo, {
      id: campos.tipo === tipoOriginal ? (transacaoParaEditar?.categoriaId ?? null) : null,
    }),
    nomeDaCategoria:
      categorias.find((c) => c.id === transacaoParaEditar?.categoriaId)?.nome ?? 'Lançamento',
  };
};

export type DadosDoPainel = ReturnType<typeof useDadosDoPainel>;
