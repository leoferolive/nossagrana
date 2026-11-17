/** Dados que a fala reconheceu para preencher o painel; cada campo é `null` se não foi dito. */
export interface DadosVoz {
  tipo: 'receita' | 'despesa' | null;
  valor: string | null;
  categoriaId: string | null;
  descricao: string | null;
  data: string | null;
}

/** Lançamento aberto para edição no painel. */
export interface TransacaoParaEditar {
  id: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  descricao: string | null;
  data: string;
  metodoPagamentoId: string | null;
}
