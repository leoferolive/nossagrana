export interface Transacao {
  id: string;
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  descricao: string | null;
  data: string;
  mesReferencia: string;
  metodoPagamentoId: string | null;
  usuarioRegistrouId: string;
  recorrente: boolean;
  frequencia: 'mensal' | 'semanal' | 'quinzenal' | null;
  dataFimRecorrencia: string | null;
  parcelado: boolean;
  numeroParcelas: number | null;
  parcelaAtual: number | null;
  valorTotal: string | null;
  valorParcela: string | null;
  transacaoPaiId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export type CreateTransacaoInput = {
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  descricao?: string | null;
  data: string;
  mesReferencia: string;
  metodoPagamentoId?: string | null;
  usuarioRegistrouId: string;
  recorrente?: boolean;
  frequencia?: 'mensal' | 'semanal' | 'quinzenal' | null;
  dataFimRecorrencia?: string | null;
  parcelado?: boolean;
  numeroParcelas?: number | null;
  parcelaAtual?: number | null;
  valorTotal?: string | null;
  valorParcela?: string | null;
  transacaoPaiId?: string | null;
};

export type UpdateTransacaoInput = {
  id: string;
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  descricao?: string | null;
  data: string;
  mesReferencia: string;
  metodoPagamentoId?: string | null;
};

export interface TransacaoFiltros {
  familiaId: string;
  mesReferencia?: string;
  tipo?: 'receita' | 'despesa';
  categoriaId?: string;
  usuarioRegistrouId?: string;
  metodoPagamentoId?: string;
}

export interface SnapshotNotifier {
  marcarDivergente(familiaId: string, mesReferencia: string): Promise<void>;
}

export interface TransacaoRepository {
  create(input: CreateTransacaoInput): Promise<Transacao>;
  createMany(inputs: CreateTransacaoInput[]): Promise<Transacao[]>;
  findById(input: { id: string; familiaId: string }): Promise<Transacao | null>;
  list(filtros: TransacaoFiltros): Promise<Transacao[]>;
  update(input: UpdateTransacaoInput): Promise<Transacao | null>;
  delete(input: { id: string; familiaId: string }): Promise<boolean>;
  deleteManyByPaiId(input: {
    transacaoPaiId: string;
    familiaId: string;
    dataMinima?: string;
  }): Promise<number>;
  listByPaiId(input: { transacaoPaiId: string; familiaId: string }): Promise<Transacao[]>;
  updateManyByPaiId(input: {
    transacaoPaiId: string;
    familiaId: string;
    dataMinima?: string;
    fields: Partial<
      Pick<Transacao, 'mesReferencia' | 'valor' | 'categoriaId' | 'descricao' | 'metodoPagamentoId'>
    >;
  }): Promise<number>;
}
