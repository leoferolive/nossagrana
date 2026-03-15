export interface MetodoPagamento {
  id: string;
  familiaId: string;
  nome: string;
  tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
  dataFechamento: number | null;
  dataVencimento: number | null;
  usuarioDonoId: string;
  ativo: boolean;
  criadoEm: Date;
}

export interface MetodoPagamentoRepository {
  listByFamiliaId(input: { familiaId: string }): Promise<MetodoPagamento[]>;
  findById(input: { id: string; familiaId: string }): Promise<MetodoPagamento | null>;
  create(input: {
    familiaId: string;
    nome: string;
    tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
    dataFechamento: number | null;
    dataVencimento: number | null;
    usuarioDonoId: string;
  }): Promise<MetodoPagamento>;
  update(input: {
    id: string;
    familiaId: string;
    nome: string;
    tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
    dataFechamento: number | null;
    dataVencimento: number | null;
  }): Promise<MetodoPagamento | null>;
  deactivate(input: { id: string; familiaId: string }): Promise<MetodoPagamento | null>;
  getFatura(
    familiaId: string,
    metodoPagamentoId: string,
    mesReferencia: string,
  ): Promise<FaturaTransacaoRow[]>;
}

export interface FaturaTransacaoRow {
  id: string;
  descricao: string | null;
  valor: string;
  data: string;
  categoriaId: string;
  categoriaNome: string;
  usuarioNome: string;
  parcelaAtual: number | null;
  numeroParcelas: number | null;
}
