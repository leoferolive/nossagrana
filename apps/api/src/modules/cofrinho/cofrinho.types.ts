export interface Cofrinho {
  id: string;
  familiaId: string;
  nome: string;
  emoji: string | null;
  descricao: string | null;
  metaValor: string | null;
  saldoAtual: string;
  status: 'ativo' | 'encerrado';
  criadoPor: string;
  criadoEm: Date;
  encerradoEm: Date | null;
}

export interface MovimentacaoCofrinho {
  id: string;
  cofrinhoId: string;
  familiaId: string;
  tipo: 'aporte' | 'retirada';
  valor: string;
  descricao: string | null;
  transacaoId: string | null;
  registradoPor: string;
  registradoEm: Date;
  mesReferencia: string;
}

export interface CofrinhoRepository {
  list(input: { familiaId: string; status: 'ativo' | 'encerrado' }): Promise<Cofrinho[]>;
  findById(input: { id: string; familiaId: string }): Promise<Cofrinho | null>;
  create(input: {
    familiaId: string;
    nome: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
    criadoPor: string;
  }): Promise<Cofrinho>;
  update(input: {
    id: string;
    familiaId: string;
    nome?: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
  }): Promise<Cofrinho | null>;
  updateSaldo(input: {
    id: string;
    familiaId: string;
    novoSaldo: string;
  }): Promise<Cofrinho | null>;
  encerrar(input: { id: string; familiaId: string }): Promise<Cofrinho | null>;
  createMovimentacao(input: {
    cofrinhoId: string;
    familiaId: string;
    tipo: 'aporte' | 'retirada';
    valor: string;
    descricao?: string | null;
    transacaoId?: string | null;
    registradoPor: string;
    mesReferencia: string;
  }): Promise<MovimentacaoCofrinho>;
  listMovimentacoes(input: {
    cofrinhoId: string;
    familiaId: string;
  }): Promise<MovimentacaoCofrinho[]>;
  findAporteRecorrenteAtivo(input: { cofrinhoId: string; familiaId: string }): Promise<{
    transacaoPaiId: string;
    valor: string;
    frequencia: 'mensal' | 'semanal' | 'quinzenal';
    dataFimRecorrencia: string | null;
  } | null>;
}

export interface TransacaoCreator {
  criar(input: {
    familiaId: string;
    tipo: 'receita' | 'despesa';
    valor: string;
    categoriaId: string;
    descricao: string | null;
    data: string;
    mesReferencia: string;
    usuarioRegistrouId: string;
    cofrinhoId: string;
  }): Promise<{ id: string }>;
}

export interface TransacaoRecorrenteCreator {
  criarRecorrente(input: {
    familiaId: string;
    tipo: 'receita' | 'despesa';
    valor: string;
    categoriaId: string;
    descricao: string | null;
    data: string;
    mesReferencia: string;
    usuarioRegistrouId: string;
    cofrinhoId: string;
    frequencia: 'mensal' | 'semanal' | 'quinzenal';
    dataFimRecorrencia?: string | null;
  }): Promise<{ id: string }>;
  cancelarRecorrencia(input: { transacaoPaiId: string; familiaId: string }): Promise<void>;
}
