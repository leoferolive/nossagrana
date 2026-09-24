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
  cofrinhoId: string | null;
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
  cofrinhoId?: string | null;
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

export interface TransacaoComCofrinho {
  id: string;
  familiaId: string;
  valor: string;
  cofrinhoId: string;
  usuarioRegistrouId: string;
  mesReferencia: string;
  descricao: string | null;
}

/**
 * Efeito de cofrinho por filha recorrente, chamado DENTRO da Unit of Work do
 * registro: grava só pelos `repos` recebidos (os do tx), nunca pelo singleton
 * `db` nem abrindo outra unidade (aninhamento é proibido). Nenhuma rota de
 * produção injeta um handler hoje (#59).
 */
export interface CofrinhoHandler {
  processarTransacaoComCofrinho(
    transacao: TransacaoComCofrinho,
    repos: TransacaoRepositorios,
  ): Promise<void>;
}

export interface RegistrarTransacaoInput {
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  descricao?: string | null;
  data: string;
  metodoPagamentoId?: string | null;
  metodoPagamentoTipo?: 'credito' | 'debito' | 'pix' | 'dinheiro' | null;
  dataFechamento?: number | null;
  usuarioRegistrouId: string;
  parcelado?: boolean;
  numeroParcelas?: number;
  recorrente?: boolean;
  frequencia?: 'mensal' | 'semanal' | 'quinzenal' | null;
  dataFimRecorrencia?: string | null;
  cofrinhoId?: string | null;
}

/** Repositórios que o registro usa dentro da Unit of Work (#78). */
export type TransacaoRepositorios = { transacoes: TransacaoRepository };

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
