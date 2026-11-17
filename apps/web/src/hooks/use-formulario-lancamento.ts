import type { TransacaoCreateRequest, TransacaoUpdateRequest } from '@nossagrana/types';
import { useCallback, useEffect, useState } from 'react';

import type { DadosVoz, TransacaoParaEditar } from '@/components/lancar/tipos-lancar';
import { getTodayLocalISO } from '@/utils/date';

type Tipo = 'receita' | 'despesa';
type Frequencia = 'mensal' | 'semanal' | 'quinzenal';

export interface CamposLancamento {
  tipo: Tipo;
  valor: string;
  categoriaId: string;
  descricao: string;
  data: string;
  metodoPagamentoId: string;
  parcelado: boolean;
  numeroParcelas: number;
  recorrente: boolean;
  frequencia: Frequencia;
  dataFimRecorrencia: string;
}

export const CAMPOS_VAZIOS: CamposLancamento = {
  tipo: 'despesa',
  valor: '',
  categoriaId: '',
  descricao: '',
  data: '',
  metodoPagamentoId: '',
  parcelado: false,
  numeroParcelas: 2,
  recorrente: false,
  frequencia: 'mensal',
  dataFimRecorrencia: '',
};

const camposDaEdicao = (t: TransacaoParaEditar): CamposLancamento => ({
  ...CAMPOS_VAZIOS,
  tipo: t.tipo,
  valor: t.valor,
  categoriaId: t.categoriaId,
  descricao: t.descricao ?? '',
  data: t.data,
  metodoPagamentoId: t.metodoPagamentoId ?? '',
});

const camposDaVoz = (v: DadosVoz): CamposLancamento => ({
  ...CAMPOS_VAZIOS,
  tipo: v.tipo ?? 'despesa',
  valor: v.valor ?? '',
  categoriaId: v.categoriaId ?? '',
  descricao: v.descricao ?? '',
  data: v.data ?? getTodayLocalISO(),
});

/** Edição tem prioridade sobre voz, como sempre teve; sem nenhuma das duas, o painel abre vazio. */
const camposIniciais = (
  edicao: TransacaoParaEditar | null | undefined,
  voz: DadosVoz | null | undefined,
): CamposLancamento | null => {
  if (voz) return camposDaVoz(voz);
  if (edicao) return camposDaEdicao(edicao);
  return null;
};

/**
 * Campos do painel de lançar. O painel é montado ao abrir, então o estado começa limpo a cada
 * abertura (hoje como data); edição e voz preenchem na montagem e de novo se mudarem com o
 * painel aberto (voz acionada de dentro do painel). A descrição vinda da edição ou da voz abre
 * "Mais opções", para o que foi preenchido não ficar escondido.
 */
export const useFormularioLancamento = (
  transacaoParaEditar: TransacaoParaEditar | null | undefined,
  dadosVoz: DadosVoz | null | undefined,
) => {
  const preenchidos = camposIniciais(transacaoParaEditar, dadosVoz);
  const [campos, setCampos] = useState<CamposLancamento>(
    () => preenchidos ?? { ...CAMPOS_VAZIOS, data: getTodayLocalISO() },
  );
  const [maisAberto, setMaisAberto] = useState(Boolean(preenchidos?.descricao));

  useEffect(() => {
    const novos = camposIniciais(transacaoParaEditar, dadosVoz);
    if (!novos) return;
    setCampos(novos);
    if (novos.descricao) setMaisAberto(true);
  }, [transacaoParaEditar, dadosVoz]);

  const mudar = useCallback(
    (parcial: Partial<CamposLancamento>) => setCampos((atuais) => ({ ...atuais, ...parcial })),
    [],
  );

  return { campos, mudar, maisAberto, alternarMais: () => setMaisAberto((v) => !v) };
};

interface EntradaDoPayload {
  campos: CamposLancamento;
  categoriaId: string;
  /** Só a forma de pagamento de cartão de crédito aceita parcelar. */
  ehCredito: boolean;
}

export const montarCriacao = ({
  campos,
  categoriaId,
  ehCredito,
}: EntradaDoPayload): TransacaoCreateRequest => {
  const parcelado = campos.parcelado && ehCredito;
  return {
    tipo: campos.tipo,
    valor: campos.valor,
    categoriaId,
    descricao: campos.descricao || null,
    data: campos.data,
    metodoPagamentoId: campos.metodoPagamentoId || null,
    parcelado,
    numeroParcelas: parcelado ? campos.numeroParcelas : null,
    recorrente: campos.recorrente,
    frequencia: campos.recorrente ? campos.frequencia : null,
    dataFimRecorrencia:
      campos.recorrente && campos.dataFimRecorrencia ? campos.dataFimRecorrencia : null,
  };
};

export const montarEdicao = ({
  campos,
  categoriaId,
}: Pick<EntradaDoPayload, 'campos' | 'categoriaId'>): TransacaoUpdateRequest => ({
  tipo: campos.tipo,
  valor: campos.valor,
  categoriaId,
  descricao: campos.descricao || null,
  data: campos.data,
  metodoPagamentoId: campos.metodoPagamentoId || null,
});
