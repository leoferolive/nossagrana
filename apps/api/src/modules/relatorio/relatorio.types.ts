export interface RelatorioTransacaoRow {
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  categoriaNome: string;
  categoriaSistema: boolean;
  mesReferencia: string;
  usuarioId: string;
  usuarioNome: string;
}

export interface RelatorioRepository {
  getTransacoes(familiaId: string, mesReferencia: string): Promise<RelatorioTransacaoRow[]>;
  getTransacoesBatch(
    familiaId: string,
    mesesReferencia: string[],
  ): Promise<RelatorioTransacaoRow[]>;
}
