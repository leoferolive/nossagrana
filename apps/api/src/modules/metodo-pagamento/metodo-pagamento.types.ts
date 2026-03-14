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
}
